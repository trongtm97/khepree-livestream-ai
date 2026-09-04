/**
 * Per-account livestream output intent — orthogonal to AutomationMode.
 * Default ASSIST_ONLY is fail-safe (no TTS / avatar / camera required).
 */
import type { AudioOutputType } from "./media-contracts";
import { isVoiceStreamAudioReady } from "./audio-routing";

export const LIVE_OUTPUT_MODES = [
  "ASSIST_ONLY",
  "VOICE_ONLY",
  "AVATAR_PREVIEW",
  "AVATAR_LIVE"
] as const;

export type LiveOutputMode = (typeof LIVE_OUTPUT_MODES)[number];

export const DEFAULT_LIVE_OUTPUT_MODE: LiveOutputMode = "ASSIST_ONLY";

export type MediaCapabilities = {
  voiceReady: boolean;
  audioRouteReady: boolean;
  avatarReady: boolean;
  videoRouteReady: boolean;
};

export type MediaCapabilityKey = keyof MediaCapabilities;

export type OutputModeRequirements = {
  needVoice: boolean;
  needAudioRoute: boolean;
  needAvatar: boolean;
  needVideoRoute: boolean;
};

export function normalizeLiveOutputMode(raw: string | null | undefined): LiveOutputMode {
  if (
    raw === "VOICE_ONLY" ||
    raw === "AVATAR_PREVIEW" ||
    raw === "AVATAR_LIVE" ||
    raw === "ASSIST_ONLY"
  ) {
    return raw;
  }
  return DEFAULT_LIVE_OUTPUT_MODE;
}

export function allowsSpeechOutput(mode: LiveOutputMode): boolean {
  return mode !== "ASSIST_ONLY";
}

export function outputModeRequirements(mode: LiveOutputMode): OutputModeRequirements {
  switch (mode) {
    case "ASSIST_ONLY":
      return {
        needVoice: false,
        needAudioRoute: false,
        needAvatar: false,
        needVideoRoute: false
      };
    case "VOICE_ONLY":
      return {
        needVoice: true,
        needAudioRoute: true,
        needAvatar: false,
        needVideoRoute: false
      };
    case "AVATAR_PREVIEW":
      return {
        needVoice: true,
        needAudioRoute: false,
        needAvatar: true,
        needVideoRoute: false
      };
    case "AVATAR_LIVE":
      return {
        needVoice: true,
        needAudioRoute: true,
        needAvatar: true,
        needVideoRoute: true
      };
  }
}

/** Resolve capability bits from TTS health + media profile + future avatar/video flags. */
export function resolveMediaCapabilities(input: {
  ttsStatus?: "OK" | "DEGRADED" | "DOWN" | "DISABLED" | "UNKNOWN";
  audioOutputType?: AudioOutputType;
  audioOutputDeviceId?: string;
  avatarReady?: boolean;
  videoRouteReady?: boolean;
}): MediaCapabilities {
  const tts = input.ttsStatus ?? "UNKNOWN";
  const voiceReady = tts === "OK" || tts === "DEGRADED" || tts === "UNKNOWN";
  const audioRouteReady = isVoiceStreamAudioReady({
    audioOutputType: input.audioOutputType ?? "local-preview",
    audioOutputDeviceId: input.audioOutputDeviceId
  }) && input.audioOutputType === "windows-endpoint";
  return {
    voiceReady,
    audioRouteReady,
    avatarReady: Boolean(input.avatarReady),
    videoRouteReady: Boolean(input.videoRouteReady)
  };
}

export function missingCapabilitiesForMode(
  mode: LiveOutputMode,
  caps: MediaCapabilities
): MediaCapabilityKey[] {
  const need = outputModeRequirements(mode);
  const missing: MediaCapabilityKey[] = [];
  if (need.needVoice && !caps.voiceReady) missing.push("voiceReady");
  if (need.needAudioRoute && !caps.audioRouteReady) missing.push("audioRouteReady");
  if (need.needAvatar && !caps.avatarReady) missing.push("avatarReady");
  if (need.needVideoRoute && !caps.videoRouteReady) missing.push("videoRouteReady");
  return missing;
}

export function isOutputModeReady(mode: LiveOutputMode, caps: MediaCapabilities): boolean {
  return missingCapabilitiesForMode(mode, caps).length === 0;
}

/**
 * License hook only — do not enforce new entitlements in this task.
 * Reserved keys for a future Khepree catalog; currently always allows.
 */
export const OUTPUT_MODE_LICENSE_HOOK_KEYS = {
  voiceOnly: "livestream_ai.voice_only_enabled",
  avatarPreview: "livestream_ai.avatar_preview_enabled",
  avatarLive: "livestream_ai.avatar_live_enabled"
} as const;

export type OutputModeLicenseGate = {
  allowed: boolean;
  /** Present when a future entitlement would block. */
  featureKey?: string;
  reason?: string;
};

/**
 * Prepare-only gate. `enforce: true` is reserved for when catalog seeds keys.
 * Until then this always returns allowed: true.
 */
export function checkOutputModeLicense(
  mode: LiveOutputMode,
  _features: Record<string, boolean | number | string>,
  opts?: { enforce?: boolean }
): OutputModeLicenseGate {
  void opts;
  if (mode === "ASSIST_ONLY") return { allowed: true };
  // ponytail: ceiling — no entitlement rows yet; upgrade = enforce reserved keys.
  return { allowed: true };
}
