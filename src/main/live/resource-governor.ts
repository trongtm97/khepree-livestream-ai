/**
 * Hardware / process capacity — separate from Khepree license limits.
 * Never invent GPU/VRAM numbers; return UNKNOWN when not measurable.
 * CPU UNKNOWN does not block start — only numeric thresholds do.
 */
import type { GpuSnapshot, ResourceMetric } from "../../shared/system-resources";
import {
  createSystemResourceMonitor,
  type SystemResourceMonitor
} from "./system-resource-monitor";

export type { ResourceMetric } from "../../shared/system-resources";
export type { GpuSnapshot } from "../../shared/system-resources";

export type HardwareBlockerCode =
  | "RAM_LOW"
  | "CPU_HIGH"
  | "TOO_MANY_RUNTIMES"
  | "TOO_MANY_TIKTOK_WORKERS"
  | "TOO_MANY_BROWSER_CONTEXTS"
  | "AI_QUEUE_BACKLOG";

export type CapacityWarningCode =
  | "RAM_PRESSURE"
  | "CPU_PRESSURE"
  | "AI_QUEUE_GROWING";

/** Future media tiers — GPU-aware selection later; not enforced this task. */
export type MediaTierHint = "FULL_AVATAR" | "VOICE_ONLY" | "ASSISTANT_NO_AVATAR";

export type ResourceSnapshot = {
  checkedAt: string;
  cpuLoadPercent: ResourceMetric;
  ramAvailableMb: ResourceMetric;
  ramUsedPercent: ResourceMetric;
  activeRuntimes: number;
  activeTikTokWorkers: number;
  activeBrowserContexts: number;
  aiQueueLength: number;
  /** GPU adapter: UNKNOWN when not queried / unavailable. Never fake VRAM. */
  gpu: GpuSnapshot;
};

export type HardwareEvaluation = {
  blockers: HardwareBlockerCode[];
  warnings: CapacityWarningCode[];
  /** Hint only — does not start/stop lives. */
  recommendedMediaTiers: MediaTierHint[];
};

export type ResourceCounts = {
  activeRuntimes: number;
  activeTikTokWorkers: number;
  activeBrowserContexts: number;
  aiQueueLength: number;
};

export type ResourceGovernor = {
  snapshot(counts: ResourceCounts): ResourceSnapshot;
  /** Evaluate whether starting one more live is safe. Does not auto-stop. */
  evaluateStart(counts: ResourceCounts): HardwareEvaluation;
};

export type ResourceGovernorOptions = {
  /** Soft warn when free RAM below this (MB). */
  ramWarnMb?: number;
  /** Hard block when free RAM below this (MB). */
  ramBlockMb?: number;
  /** Soft warn when CPU load above this (%). */
  cpuWarnPercent?: number;
  /** Hard block when CPU load above this (%). */
  cpuBlockPercent?: number;
  /** Soft warn when AI queue length exceeds. */
  aiQueueWarn?: number;
  /** Hard block when AI queue length exceeds. */
  aiQueueBlock?: number;
  /**
   * Optional hard cap on concurrent runtimes from hardware budget.
   * Undefined = no hardware concurrency cap (license still applies separately).
   */
  maxHardwareRuntimes?: number;
  /** Injected monitor (tests). Production creates one. */
  monitor?: SystemResourceMonitor;
};

const DEFAULTS: Required<
  Omit<ResourceGovernorOptions, "maxHardwareRuntimes" | "monitor">
> & { maxHardwareRuntimes?: number } = {
  ramWarnMb: 768,
  ramBlockMb: 384,
  cpuWarnPercent: 85,
  cpuBlockPercent: 97,
  aiQueueWarn: 40,
  aiQueueBlock: 120,
  maxHardwareRuntimes: undefined
};

function recommendMediaTiers(gpu: ResourceSnapshot["gpu"]): MediaTierHint[] {
  if (gpu === "UNKNOWN") {
    // Without GPU signal, prefer non-avatar tiers (hint only).
    return ["ASSISTANT_NO_AVATAR", "VOICE_ONLY"];
  }
  if (!gpu.available) return ["ASSISTANT_NO_AVATAR"];
  const free = gpu.vramFreeMb;
  if (free === undefined || free === "UNKNOWN") return ["VOICE_ONLY", "ASSISTANT_NO_AVATAR"];
  if (free < 2048) return ["VOICE_ONLY", "ASSISTANT_NO_AVATAR"];
  return ["FULL_AVATAR", "VOICE_ONLY", "ASSISTANT_NO_AVATAR"];
}

export type OsResourceGovernor = ResourceGovernor & {
  readonly monitor: SystemResourceMonitor;
  start(): void;
  stop(): void;
};

/** Production governor — SystemResourceMonitor cache; UNKNOWN never blocks CPU. */
export function createOsResourceGovernor(
  opts: ResourceGovernorOptions = {}
): OsResourceGovernor {
  const { monitor: injected, ...rest } = opts;
  const cfg = { ...DEFAULTS, ...rest };
  const monitor = injected ?? createSystemResourceMonitor();

  const governor: OsResourceGovernor = {
    monitor,
    start() {
      monitor.start();
    },
    stop() {
      monitor.stop();
    },
    snapshot(counts) {
      const m = monitor.getSnapshot();
      return {
        checkedAt: m.checkedAt,
        cpuLoadPercent: m.cpuLoadPercent,
        ramAvailableMb: m.ramAvailableMb,
        ramUsedPercent: m.ramUsedPercent,
        activeRuntimes: counts.activeRuntimes,
        activeTikTokWorkers: counts.activeTikTokWorkers,
        activeBrowserContexts: counts.activeBrowserContexts,
        aiQueueLength: counts.aiQueueLength,
        gpu: m.gpu
      };
    },

    evaluateStart(counts) {
      const snap = this.snapshot(counts);
      const blockers: HardwareBlockerCode[] = [];
      const warnings: CapacityWarningCode[] = [];

      if (typeof snap.ramAvailableMb === "number") {
        if (snap.ramAvailableMb < cfg.ramBlockMb) blockers.push("RAM_LOW");
        else if (snap.ramAvailableMb < cfg.ramWarnMb) warnings.push("RAM_PRESSURE");
      }

      // CPU UNKNOWN → skip (do not block start).
      if (typeof snap.cpuLoadPercent === "number") {
        if (snap.cpuLoadPercent >= cfg.cpuBlockPercent) blockers.push("CPU_HIGH");
        else if (snap.cpuLoadPercent >= cfg.cpuWarnPercent) warnings.push("CPU_PRESSURE");
      }

      if (
        cfg.maxHardwareRuntimes !== undefined &&
        counts.activeRuntimes >= cfg.maxHardwareRuntimes
      ) {
        blockers.push("TOO_MANY_RUNTIMES");
      }

      if (counts.aiQueueLength >= cfg.aiQueueBlock) blockers.push("AI_QUEUE_BACKLOG");
      else if (counts.aiQueueLength >= cfg.aiQueueWarn) warnings.push("AI_QUEUE_GROWING");

      return {
        blockers,
        warnings,
        recommendedMediaTiers: recommendMediaTiers(snap.gpu)
      };
    }
  };

  return governor;
}

/**
 * Deterministic governor for tests / explicit hardware budget mocks.
 * Does not read OS — only count caps you pass.
 */
export function createMockResourceGovernor(input: {
  maxRuntimes: number;
  ramAvailableMb?: number | "UNKNOWN";
  cpuLoadPercent?: number | "UNKNOWN";
  gpu?: GpuSnapshot;
}): ResourceGovernor {
  return {
    snapshot(counts) {
      return {
        checkedAt: new Date().toISOString(),
        cpuLoadPercent: input.cpuLoadPercent ?? "UNKNOWN",
        ramAvailableMb: input.ramAvailableMb ?? "UNKNOWN",
        ramUsedPercent: "UNKNOWN",
        activeRuntimes: counts.activeRuntimes,
        activeTikTokWorkers: counts.activeTikTokWorkers,
        activeBrowserContexts: counts.activeBrowserContexts,
        aiQueueLength: counts.aiQueueLength,
        gpu: input.gpu ?? "UNKNOWN"
      };
    },
    evaluateStart(counts) {
      const blockers: HardwareBlockerCode[] = [];
      const warnings: CapacityWarningCode[] = [];
      if (counts.activeRuntimes >= input.maxRuntimes) {
        blockers.push("TOO_MANY_RUNTIMES");
      }
      if (typeof input.ramAvailableMb === "number" && input.ramAvailableMb < 384) {
        blockers.push("RAM_LOW");
      }
      if (typeof input.cpuLoadPercent === "number" && input.cpuLoadPercent >= 97) {
        blockers.push("CPU_HIGH");
      }
      return {
        blockers,
        warnings,
        recommendedMediaTiers: ["ASSISTANT_NO_AVATAR", "VOICE_ONLY"]
      };
    }
  };
}
