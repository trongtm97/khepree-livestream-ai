/**
 * GPU media scheduling contracts (renderer-safe).
 * Separate from AiRequestScheduler (Gemini). No GPU brand mapping in business logic —
 * providers report capability; scheduler only admits/prioritizes.
 */

export type AvatarGpuPriority = "speaking" | "idle";

/** Quality concept tiers — providers map models → tier; never hard-code GPU SKUs here. */
export type AvatarQualityTier = "LIGHT" | "BALANCED" | "QUALITY";

export type GpuMediaWarningCode =
  | "FPS_BELOW_TARGET"
  | "GPU_PRESSURE"
  | "GPU_UNKNOWN"
  | "PREVIEW_FPS_REDUCED"
  | "SUGGEST_LIGHTER_ENGINE"
  | "USING_IDLE_PRERECORDED";

export type GpuMediaWarning = {
  code: GpuMediaWarningCode;
  message: string;
  accountId?: string;
  at: string;
};

export type GpuAdmissionDenyCode =
  | "GPU_CAPACITY"
  | "GPU_VRAM"
  | "GPU_UTIL"
  | "GPU_UNAVAILABLE"
  | "MODEL_NOT_LOADED";

/** Provider-reported capability for admission — no nvidia/amd branching. */
export type AvatarGpuCapability = {
  model: string;
  qualityTier: AvatarQualityTier;
  estimatedVramMb: number;
  /** Soft concurrent slots (mock capacity tests). External off-box engines may be 0. */
  capacitySlots: number;
  supportsIdlePrerecorded: boolean;
  maxTargetFps: number;
  modelLoaded: boolean;
};

export type AvatarGpuSessionPublic = {
  accountId: string;
  model: string;
  targetFps: number;
  priority: AvatarGpuPriority;
  estimatedVramMb: number;
  qualityTier: AvatarQualityTier;
  capacitySlots: number;
  measuredFps?: number;
  useIdlePrerecorded: boolean;
};

export type GpuMediaSchedulerPublicState = {
  activeSessions: AvatarGpuSessionPublic[];
  usedSlots: number;
  maxAvatarSlots?: number;
  warnings: GpuMediaWarning[];
};
