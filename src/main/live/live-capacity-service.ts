import type { LivestreamLicenseLimits } from "../../shared/khepree-livestream-features";
import { resolveLivestreamLicenseLimits } from "../../shared/khepree-livestream-features";
import type {
  CapacityWarningCode,
  HardwareBlockerCode,
  ResourceGovernor,
  ResourceSnapshot
} from "./resource-governor";
import { createMockResourceGovernor } from "./resource-governor";

export type LicenseBlockerCode =
  | "KHEPREE_ACCESS_REQUIRED"
  | "MULTI_LIVE_REQUIRED"
  | "MAX_CONCURRENT_LIVES"
  | "MAX_TIKTOK_ACCOUNTS";

export type StartLiveDecision = {
  allowed: boolean;
  licenseBlockers: LicenseBlockerCode[];
  hardwareBlockers: HardwareBlockerCode[];
  warnings: CapacityWarningCode[];
  /** License max concurrent (for operator message interpolation). */
  licenseMaxConcurrentLives: number;
  /** License max TikTok accounts. */
  licenseMaxTikTokAccounts: number;
};

export type CreateAccountDecision = {
  allowed: boolean;
  licenseBlockers: LicenseBlockerCode[];
  licenseMaxTikTokAccounts: number;
  currentAccountCount: number;
};

export type LiveCapacityContext = {
  activeRuntimes: number;
  activeTikTokWorkers: number;
  activeBrowserContexts: number;
  aiQueueLength: number;
  accountCount: number;
  /** True when this account is already live — start is a no-op / already active. */
  accountAlreadyLive?: boolean;
};

export type LiveCapacityServiceDeps = {
  /** Current Khepree feature map (+ status gate). */
  getFeatures: () => Record<string, boolean | number | string>;
  isLicenseActive: () => boolean;
  governor: ResourceGovernor;
};

/**
 * Separates Khepree license limits from hardware capacity.
 * Does not auto-stop lives on transient spikes.
 */
export class LiveCapacityService {
  constructor(private readonly deps: LiveCapacityServiceDeps) {}

  getLicenseLimits(): LivestreamLicenseLimits {
    return resolveLivestreamLicenseLimits(this.deps.getFeatures());
  }

  resourceSnapshot(ctx: LiveCapacityContext): ResourceSnapshot {
    return this.deps.governor.snapshot({
      activeRuntimes: ctx.activeRuntimes,
      activeTikTokWorkers: ctx.activeTikTokWorkers,
      activeBrowserContexts: ctx.activeBrowserContexts,
      aiQueueLength: ctx.aiQueueLength
    });
  }

  canCreateAccount(currentAccountCount: number): CreateAccountDecision {
    const licenseBlockers: LicenseBlockerCode[] = [];
    if (!this.deps.isLicenseActive()) {
      licenseBlockers.push("KHEPREE_ACCESS_REQUIRED");
    }
    const limits = this.getLicenseLimits();
    if (currentAccountCount >= limits.maxTikTokAccounts) {
      licenseBlockers.push("MAX_TIKTOK_ACCOUNTS");
    }
    return {
      allowed: licenseBlockers.length === 0,
      licenseBlockers,
      licenseMaxTikTokAccounts: limits.maxTikTokAccounts,
      currentAccountCount
    };
  }

  canStartLive(ctx: LiveCapacityContext): StartLiveDecision {
    const limits = this.getLicenseLimits();
    const licenseBlockers: LicenseBlockerCode[] = [];

    if (!this.deps.isLicenseActive()) {
      licenseBlockers.push("KHEPREE_ACCESS_REQUIRED");
    }

    // Starting a 2nd concurrent live requires multi_live_enabled.
    if (ctx.activeRuntimes >= 1 && !limits.multiLiveEnabled) {
      licenseBlockers.push("MULTI_LIVE_REQUIRED");
    }

    if (ctx.activeRuntimes >= limits.maxConcurrentLives) {
      licenseBlockers.push("MAX_CONCURRENT_LIVES");
    }

    const hw = this.deps.governor.evaluateStart({
      activeRuntimes: ctx.activeRuntimes,
      activeTikTokWorkers: ctx.activeTikTokWorkers,
      activeBrowserContexts: ctx.activeBrowserContexts,
      aiQueueLength: ctx.aiQueueLength
    });

    return {
      allowed: licenseBlockers.length === 0 && hw.blockers.length === 0,
      licenseBlockers,
      hardwareBlockers: hw.blockers,
      warnings: hw.warnings,
      licenseMaxConcurrentLives: limits.maxConcurrentLives,
      licenseMaxTikTokAccounts: limits.maxTikTokAccounts
    };
  }

  /**
   * Throw typed errors for main-process enforcement.
   * License errors first; hardware second (never mix codes).
   */
  assertCanCreateAccount(currentAccountCount: number): void {
    const d = this.canCreateAccount(currentAccountCount);
    if (d.allowed) return;
    if (d.licenseBlockers.includes("KHEPREE_ACCESS_REQUIRED")) {
      throw new Error("KHEPREE_ACCESS_REQUIRED");
    }
    if (d.licenseBlockers.includes("MAX_TIKTOK_ACCOUNTS")) {
      throw new Error(`LICENSE_MAX_TIKTOK_ACCOUNTS:${d.licenseMaxTikTokAccounts}`);
    }
    throw new Error("KHEPREE_ACCESS_REQUIRED");
  }

  assertCanStartLive(ctx: LiveCapacityContext): StartLiveDecision {
    const d = this.canStartLive(ctx);
    if (d.allowed) return d;

    if (d.licenseBlockers.includes("KHEPREE_ACCESS_REQUIRED")) {
      throw new Error("KHEPREE_ACCESS_REQUIRED");
    }
    if (d.licenseBlockers.includes("MULTI_LIVE_REQUIRED")) {
      throw new Error("LICENSE_MULTI_LIVE_REQUIRED");
    }
    if (d.licenseBlockers.includes("MAX_CONCURRENT_LIVES")) {
      throw new Error(`LICENSE_MAX_CONCURRENT_LIVES:${d.licenseMaxConcurrentLives}`);
    }

    const hw = d.hardwareBlockers[0];
    if (hw === "RAM_LOW") throw new Error("HARDWARE_RAM_LOW");
    if (hw === "CPU_HIGH") throw new Error("HARDWARE_CPU_HIGH");
    if (hw === "TOO_MANY_RUNTIMES") throw new Error("HARDWARE_TOO_MANY_RUNTIMES");
    if (hw === "TOO_MANY_TIKTOK_WORKERS") throw new Error("HARDWARE_TOO_MANY_TIKTOK_WORKERS");
    if (hw === "TOO_MANY_BROWSER_CONTEXTS") throw new Error("HARDWARE_TOO_MANY_BROWSER_CONTEXTS");
    if (hw === "AI_QUEUE_BACKLOG") throw new Error("HARDWARE_AI_QUEUE_BACKLOG");

    throw new Error("HARDWARE_CAPACITY");
  }
}

/** Test / self-check helper — explicit limits, never Infinity. */
export function createTestLiveCapacity(opts: {
  maxConcurrentLives?: number;
  maxTikTokAccounts?: number;
  multiLiveEnabled?: boolean;
  maxHardwareRuntimes?: number;
  licenseActive?: boolean;
}): LiveCapacityService {
  const multi = opts.multiLiveEnabled ?? true;
  const maxLives = opts.maxConcurrentLives ?? 5;
  const maxAccounts = opts.maxTikTokAccounts ?? 10;
  return new LiveCapacityService({
    isLicenseActive: () => opts.licenseActive !== false,
    getFeatures: () => ({
      "livestream_ai.access": true,
      multi_live_enabled: multi,
      max_concurrent_lives: maxLives,
      max_tiktok_accounts: maxAccounts
    }),
    governor: createMockResourceGovernor({
      maxRuntimes: opts.maxHardwareRuntimes ?? 9_999
    })
  });
}
