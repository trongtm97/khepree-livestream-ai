/**
 * GpuMediaScheduler — avatar inference capacity (not Gemini / AiRequestScheduler).
 * Admission before AVATAR_LIVE; speaking > idle; overload warnings are never silent.
 */
import type { GpuSnapshot } from "../../shared/system-resources";
import type {
  AvatarGpuCapability,
  AvatarGpuPriority,
  AvatarGpuSessionPublic,
  AvatarQualityTier,
  GpuAdmissionDenyCode,
  GpuMediaSchedulerPublicState,
  GpuMediaWarning
} from "../../shared/gpu-media";

export type {
  AvatarGpuCapability,
  AvatarGpuPriority,
  AvatarQualityTier,
  GpuAdmissionDenyCode,
  GpuMediaWarning
} from "../../shared/gpu-media";

export type AvatarGpuSessionRegistration = {
  accountId: string;
  model: string;
  targetFps: number;
  priority: AvatarGpuPriority;
  estimatedVramMb: number;
  qualityTier?: AvatarQualityTier;
  capacitySlots?: number;
  modelLoaded?: boolean;
  supportsIdlePrerecorded?: boolean;
};

export type GpuAdmissionDecision = {
  allowed: boolean;
  code?: GpuAdmissionDenyCode;
  reason?: string;
  /** Soft degrade — operator should switch mode; do not crash. */
  suggestedOutputMode?: "VOICE_ONLY" | "AVATAR_PREVIEW";
  warnings: GpuMediaWarning[];
};

export type GpuMediaSchedulerOptions = {
  /**
   * Concurrent AVATAR_LIVE slot budget (mock tests use 2).
   * Undefined = no slot cap; VRAM/util still apply when measurable.
   */
  maxAvatarSlots?: number;
  /** From SystemResourceMonitor — never invent numbers. */
  getGpuSnapshot?: () => GpuSnapshot;
  /** Extra free VRAM required beyond session estimate when free is known. */
  vramHeadroomMb?: number;
  /** Block admit when utilization >= this (only if measurable). */
  utilBlockPercent?: number;
  /** Soft warn when utilization >= this. */
  utilWarnPercent?: number;
  now?: () => number;
  /** Max warnings retained for operator UI. */
  maxWarnings?: number;
};

type InternalSession = AvatarGpuSessionPublic & {
  supportsIdlePrerecorded: boolean;
  modelLoaded: boolean;
};

function warn(
  code: GpuMediaWarning["code"],
  message: string,
  accountId: string | undefined,
  now: () => number
): GpuMediaWarning {
  return { code, message, accountId, at: new Date(now()).toISOString() };
}

export class GpuMediaScheduler {
  private readonly sessions = new Map<string, InternalSession>();
  private readonly warnings: GpuMediaWarning[] = [];
  private readonly maxAvatarSlots?: number;
  private readonly getGpuSnapshot?: () => GpuSnapshot;
  private readonly vramHeadroomMb: number;
  private readonly utilBlockPercent: number;
  private readonly utilWarnPercent: number;
  private readonly now: () => number;
  private readonly maxWarnings: number;
  private rrSpeaking = 0;
  private rrIdle = 0;

  constructor(opts: GpuMediaSchedulerOptions = {}) {
    this.maxAvatarSlots = opts.maxAvatarSlots;
    this.getGpuSnapshot = opts.getGpuSnapshot;
    this.vramHeadroomMb = opts.vramHeadroomMb ?? 256;
    this.utilBlockPercent = opts.utilBlockPercent ?? 95;
    this.utilWarnPercent = opts.utilWarnPercent ?? 85;
    this.now = opts.now ?? Date.now;
    this.maxWarnings = opts.maxWarnings ?? 40;
  }

  usedSlots(): number {
    let n = 0;
    for (const s of this.sessions.values()) n += s.capacitySlots;
    return n;
  }

  getPublicState(): GpuMediaSchedulerPublicState {
    return {
      activeSessions: [...this.sessions.values()].map((s) => ({
        accountId: s.accountId,
        model: s.model,
        targetFps: s.targetFps,
        priority: s.priority,
        estimatedVramMb: s.estimatedVramMb,
        qualityTier: s.qualityTier,
        capacitySlots: s.capacitySlots,
        measuredFps: s.measuredFps,
        useIdlePrerecorded: s.useIdlePrerecorded
      })),
      usedSlots: this.usedSlots(),
      maxAvatarSlots: this.maxAvatarSlots,
      warnings: [...this.warnings]
    };
  }

  /**
   * Admission control before starting AVATAR_LIVE.
   * Does not register — call registerSession after live actually starts.
   */
  admitAvatarLive(req: AvatarGpuSessionRegistration): GpuAdmissionDecision {
    const warnings: GpuMediaWarning[] = [];
    const slots = req.capacitySlots ?? 1;
    const modelLoaded = req.modelLoaded !== false;
    const estimatedVramMb = Math.max(0, Math.floor(req.estimatedVramMb));

    if (!modelLoaded) {
      return {
        allowed: false,
        code: "MODEL_NOT_LOADED",
        reason: "Avatar model is not loaded",
        suggestedOutputMode: "VOICE_ONLY",
        warnings
      };
    }

    if (this.sessions.has(req.accountId)) {
      return { allowed: true, warnings };
    }

    if (
      this.maxAvatarSlots !== undefined &&
      slots > 0 &&
      this.usedSlots() + slots > this.maxAvatarSlots
    ) {
      return {
        allowed: false,
        code: "GPU_CAPACITY",
        reason: `Avatar GPU slots full (${this.usedSlots()}/${this.maxAvatarSlots})`,
        suggestedOutputMode: "VOICE_ONLY",
        warnings
      };
    }

    const gpu = this.getGpuSnapshot?.() ?? "UNKNOWN";
    if (gpu === "UNKNOWN") {
      warnings.push(
        warn(
          "GPU_UNKNOWN",
          "GPU metrics unavailable — capacity inferred from slot budget only",
          req.accountId,
          this.now
        )
      );
    } else if (!gpu.available) {
      return {
        allowed: false,
        code: "GPU_UNAVAILABLE",
        reason: "GPU reported unavailable",
        suggestedOutputMode: "VOICE_ONLY",
        warnings
      };
    } else {
      const util = gpu.utilizationPercent;
      if (typeof util === "number") {
        if (util >= this.utilBlockPercent) {
          return {
            allowed: false,
            code: "GPU_UTIL",
            reason: `GPU utilization ${util}% too high`,
            suggestedOutputMode: "VOICE_ONLY",
            warnings
          };
        }
        if (util >= this.utilWarnPercent) {
          warnings.push(
            warn("GPU_PRESSURE", `GPU utilization ${util}%`, req.accountId, this.now)
          );
        }
      }
      const free = gpu.vramFreeMb;
      if (typeof free === "number" && estimatedVramMb > 0) {
        const reserved = [...this.sessions.values()].reduce((a, s) => a + s.estimatedVramMb, 0);
        const need = estimatedVramMb + this.vramHeadroomMb;
        if (free - reserved < need) {
          return {
            allowed: false,
            code: "GPU_VRAM",
            reason: `Insufficient VRAM (need ~${need}MB free after reserved)`,
            suggestedOutputMode: "VOICE_ONLY",
            warnings
          };
        }
      }
    }

    return { allowed: true, warnings };
  }

  registerSession(req: AvatarGpuSessionRegistration): void {
    const admit = this.admitAvatarLive(req);
    if (!admit.allowed) {
      throw new Error(
        `AVATAR_LIVE_GPU_DENIED:${admit.suggestedOutputMode ?? "VOICE_ONLY"}:${admit.code}`
      );
    }
    for (const w of admit.warnings) this.pushWarning(w);
    const priority = req.priority;
    const supportsIdle = req.supportsIdlePrerecorded !== false;
    this.sessions.set(req.accountId, {
      accountId: req.accountId,
      model: req.model,
      targetFps: Math.max(1, Math.floor(req.targetFps)),
      priority,
      estimatedVramMb: Math.max(0, Math.floor(req.estimatedVramMb)),
      qualityTier: req.qualityTier ?? "BALANCED",
      capacitySlots: req.capacitySlots ?? 1,
      useIdlePrerecorded: priority === "idle" && supportsIdle,
      supportsIdlePrerecorded: supportsIdle,
      modelLoaded: req.modelLoaded !== false
    });
  }

  unregisterSession(accountId: string): void {
    this.sessions.delete(accountId);
  }

  setPriority(accountId: string, priority: AvatarGpuPriority): void {
    const s = this.sessions.get(accountId);
    if (!s) return;
    s.priority = priority;
    s.useIdlePrerecorded = priority === "idle" && s.supportsIdlePrerecorded;
    if (s.useIdlePrerecorded) {
      this.pushWarning(
        warn(
          "USING_IDLE_PRERECORDED",
          "Idle avatar using prerecorded frames (GPU deprioritized)",
          accountId,
          this.now
        )
      );
    }
  }

  /**
   * Fair pick: speaking sessions before idle.
   * Idle may skip inference when useIdlePrerecorded is set.
   */
  pickNextInferenceAccount(): string | undefined {
    const speaking = [...this.sessions.values()].filter((s) => s.priority === "speaking");
    const idleNeedGpu = [...this.sessions.values()].filter(
      (s) => s.priority === "idle" && !s.useIdlePrerecorded
    );
    const pool = speaking.length > 0 ? speaking : idleNeedGpu;
    if (pool.length === 0) return undefined;
    if (speaking.length > 0) {
      const i = this.rrSpeaking % pool.length;
      this.rrSpeaking += 1;
      return pool[i]!.accountId;
    }
    const i = this.rrIdle % pool.length;
    this.rrIdle += 1;
    return pool[i]!.accountId;
  }

  shouldUseIdlePrerecorded(accountId: string): boolean {
    return Boolean(this.sessions.get(accountId)?.useIdlePrerecorded);
  }

  /**
   * Operator-visible overload: measured FPS below target.
   * May recommend preview FPS cut / lighter engine — never silent.
   */
  reportInferenceFps(accountId: string, measuredFps: number): GpuMediaWarning[] {
    const s = this.sessions.get(accountId);
    if (!s) return [];
    s.measuredFps = measuredFps;
    const out: GpuMediaWarning[] = [];
    if (measuredFps + 0.5 < s.targetFps) {
      const fpsWarn = warn(
        "FPS_BELOW_TARGET",
        `Avatar inference ${measuredFps.toFixed(1)} FPS < target ${s.targetFps}`,
        accountId,
        this.now
      );
      out.push(fpsWarn);
      this.pushWarning(fpsWarn);
      const preview = warn(
        "PREVIEW_FPS_REDUCED",
        "Reduce local preview FPS to free GPU for live avatars",
        accountId,
        this.now
      );
      out.push(preview);
      this.pushWarning(preview);
      if (s.qualityTier !== "LIGHT") {
        const light = warn(
          "SUGGEST_LIGHTER_ENGINE",
          "Switch avatar quality tier toward LIGHT or use Voice Only",
          accountId,
          this.now
        );
        out.push(light);
        this.pushWarning(light);
      }
    }
    return out;
  }

  private pushWarning(w: GpuMediaWarning): void {
    this.warnings.push(w);
    while (this.warnings.length > this.maxWarnings) this.warnings.shift();
  }
}

/**
 * Capability from avatar engine settings — provider/kind driven, not GPU brand.
 */
export function capabilityFromAvatarEngine(input: {
  kind: string;
  modelLoaded?: boolean;
  qualityTier?: AvatarQualityTier;
}): AvatarGpuCapability {
  const tier = input.qualityTier ?? "BALANCED";
  if (input.kind === "musetalk-local") {
    const vram = tier === "LIGHT" ? 2048 : tier === "QUALITY" ? 6144 : 4096;
    return {
      model: "musetalk-local",
      qualityTier: tier,
      estimatedVramMb: vram,
      capacitySlots: 1,
      supportsIdlePrerecorded: true,
      maxTargetFps: tier === "QUALITY" ? 30 : 25,
      modelLoaded: input.modelLoaded !== false
    };
  }
  if (input.kind === "livetalking") {
    // Off-box GPU — do not consume local avatar slots by default.
    return {
      model: "livetalking",
      qualityTier: tier,
      estimatedVramMb: 0,
      capacitySlots: 0,
      supportsIdlePrerecorded: true,
      maxTargetFps: 25,
      modelLoaded: input.modelLoaded !== false
    };
  }
  return {
    model: input.kind || "none",
    qualityTier: "LIGHT",
    estimatedVramMb: 0,
    capacitySlots: 0,
    supportsIdlePrerecorded: true,
    maxTargetFps: 15,
    modelLoaded: true
  };
}
