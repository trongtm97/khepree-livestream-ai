/**
 * Hardware / process capacity — separate from Khepree license limits.
 * Never invent GPU/VRAM numbers; return UNKNOWN when not measurable.
 */
import os from "node:os";

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

export type ResourceMetric = number | "UNKNOWN";

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
  gpu: "UNKNOWN" | { available: boolean; vramFreeMb: ResourceMetric };
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
};

const DEFAULTS: Required<
  Omit<ResourceGovernorOptions, "maxHardwareRuntimes">
> & { maxHardwareRuntimes?: number } = {
  ramWarnMb: 768,
  ramBlockMb: 384,
  cpuWarnPercent: 85,
  cpuBlockPercent: 97,
  aiQueueWarn: 40,
  aiQueueBlock: 120,
  maxHardwareRuntimes: undefined
};

function readOsMetrics(): {
  cpuLoadPercent: ResourceMetric;
  ramAvailableMb: ResourceMetric;
  ramUsedPercent: ResourceMetric;
} {
  try {
    const total = os.totalmem();
    const free = os.freemem();
    const ramAvailableMb = Math.floor(free / (1024 * 1024));
    const ramUsedPercent =
      total > 0 ? Math.min(100, Math.round(((total - free) / total) * 100)) : "UNKNOWN";

    // loadavg is often [0,0,0] on Windows — treat as UNKNOWN there.
    const loads = os.loadavg();
    const cores = Math.max(1, os.cpus()?.length ?? 1);
    const oneMin = loads[0] ?? Number.NaN;
    const cpuLoadPercent =
      process.platform === "win32" || !Number.isFinite(oneMin)
        ? ("UNKNOWN" as const)
        : Math.min(100, Math.round((oneMin / cores) * 100));

    return { cpuLoadPercent, ramAvailableMb, ramUsedPercent };
  } catch {
    return {
      cpuLoadPercent: "UNKNOWN",
      ramAvailableMb: "UNKNOWN",
      ramUsedPercent: "UNKNOWN"
    };
  }
}

function recommendMediaTiers(gpu: ResourceSnapshot["gpu"]): MediaTierHint[] {
  if (gpu === "UNKNOWN") {
    // Without GPU signal, prefer non-avatar tiers (hint only).
    return ["ASSISTANT_NO_AVATAR", "VOICE_ONLY"];
  }
  if (!gpu.available) return ["ASSISTANT_NO_AVATAR"];
  if (gpu.vramFreeMb === "UNKNOWN") return ["VOICE_ONLY", "ASSISTANT_NO_AVATAR"];
  if (gpu.vramFreeMb < 2048) return ["VOICE_ONLY", "ASSISTANT_NO_AVATAR"];
  return ["FULL_AVATAR", "VOICE_ONLY", "ASSISTANT_NO_AVATAR"];
}

/** Production governor — real OS RAM; CPU/GPU may be UNKNOWN. */
export function createOsResourceGovernor(
  opts: ResourceGovernorOptions = {}
): ResourceGovernor {
  const cfg = { ...DEFAULTS, ...opts };

  return {
    snapshot(counts) {
      const osMetrics = readOsMetrics();
      return {
        checkedAt: new Date().toISOString(),
        ...osMetrics,
        activeRuntimes: counts.activeRuntimes,
        activeTikTokWorkers: counts.activeTikTokWorkers,
        activeBrowserContexts: counts.activeBrowserContexts,
        aiQueueLength: counts.aiQueueLength,
        gpu: "UNKNOWN"
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
}

/**
 * Deterministic governor for tests / explicit hardware budget mocks.
 * Does not read OS — only count caps you pass.
 */
export function createMockResourceGovernor(input: {
  maxRuntimes: number;
  ramAvailableMb?: number | "UNKNOWN";
  cpuLoadPercent?: number | "UNKNOWN";
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
        gpu: "UNKNOWN"
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
      return {
        blockers,
        warnings,
        recommendedMediaTiers: ["ASSISTANT_NO_AVATAR", "VOICE_ONLY"]
      };
    }
  };
}
