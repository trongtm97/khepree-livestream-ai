/** Public media / TTS contracts (renderer-safe). */

export type TtsProviderId = "windows-sapi" | "mock";

/** Where TTS WAV is routed after synthesis. */
export type AudioOutputType = "local-preview" | "windows-endpoint";

export type TtsVoiceInfo = {
  id: string;
  name: string;
  locale?: string;
  gender?: string;
};

/** Optional external avatar engine. Default: none. */
export type AvatarEngineKind = "none" | "livetalking" | "musetalk-local";

/** Server-side LiveTalking transport; Khepree does not run the GPU process. */
export type LiveTalkingTransport = "webrtc" | "virtualcam" | "rtmp" | "rtcpush";

export type AvatarEngineSettings = {
  kind: AvatarEngineKind;
  /** Base URL — LiveTalking host or local MuseTalk worker, e.g. http://127.0.0.1:8765 */
  serverUrl?: string;
  avatarId?: string;
  model?: string;
  transport?: LiveTalkingTransport;
  /** HTTP timeout ms for probe / session / audio. */
  connectionTimeoutMs?: number;
  /** MuseTalk: operator model directory (never inside asar). */
  modelDir?: string;
  /** MuseTalk: preprocess cache root (defaults under modelDir). */
  cacheDir?: string;
  /** MuseTalk: source video for one-time preprocess. */
  sourceVideoPath?: string;
};

export const DEFAULT_AVATAR_ENGINE: AvatarEngineSettings = { kind: "none" };

export type MediaProfile = {
  id: string;
  accountId: string;
  providerId: TtsProviderId;
  voiceId?: string;
  /** 0.5–2.0 relative speaking rate (1 = normal). */
  rate: number;
  /**
   * Audio sink for livestream TTS.
   * Missing / legacy rows → treat as local-preview.
   */
  audioOutputType: AudioOutputType;
  /** Stable Windows endpoint id when audioOutputType is windows-endpoint. */
  audioOutputDeviceId?: string;
  /** Optional external avatar engine (LiveTalking / MuseTalk). Default none. */
  avatarEngine: AvatarEngineSettings;
  /** Selected library avatar asset id (operator library). */
  selectedAvatarId?: string;
  updatedAt: string;
};

/** Playback/render endpoint from the Windows audio bridge (no WASAPI jargon in Basic UI). */
export type AudioDeviceInfo = {
  id: string;
  name: string;
  state: "ACTIVE" | "DISABLED" | "UNPLUGGED" | "NOTPRESENT" | "UNKNOWN";
  isDefault: boolean;
};

export type MediaEnginePublicState = {
  providerId: TtsProviderId;
  status: "OK" | "DEGRADED" | "DOWN" | "UNKNOWN";
  message: string;
  voiceCount: number;
  checkedAt: string;
};

/** Pluggable avatar engines — MuseTalk stays out of business core. */
export type AvatarProviderId = "mock" | "external-livetalking" | "musetalk-local";

export type AvatarHealthStatus = "READY" | "LOADING" | "DEGRADED" | "DOWN";

export type AvatarHealth = {
  status: AvatarHealthStatus;
  message?: string;
  checkedAt: string;
};

export type AvatarProfile = {
  id: string;
  name: string;
  providerId: AvatarProviderId;
  sourceAssetPath: string;
  previewImagePath?: string;
  modelConfig?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type AvatarSessionStatus = "idle" | "speaking" | "stopped" | "error";

export type AvatarSession = {
  accountId: string;
  sessionId: string;
  providerSessionId: string;
  status: AvatarSessionStatus;
};

export type MuseTalkMetrics = {
  inferFPS: number;
  finalFPS: number;
  vramMb: number;
  gpuUtilization: number;
  queueDelayMs: number;
  realtimeOk: boolean;
  gpuTier: string;
  sampledJobs?: number;
};

export function normalizeAvatarEngine(
  raw: AvatarEngineSettings | null | undefined
): AvatarEngineSettings {
  if (!raw || (raw.kind !== "livetalking" && raw.kind !== "musetalk-local")) {
    return { ...DEFAULT_AVATAR_ENGINE };
  }
  const timeout = raw.connectionTimeoutMs;
  const connectionTimeoutMs =
    typeof timeout === "number" && Number.isFinite(timeout) && timeout > 0
      ? Math.min(120_000, Math.max(500, Math.floor(timeout)))
      : 8_000;
  if (raw.kind === "musetalk-local") {
    return {
      kind: "musetalk-local",
      serverUrl: (raw.serverUrl ?? "").trim() || undefined,
      avatarId: (raw.avatarId ?? "").trim() || undefined,
      modelDir: (raw.modelDir ?? "").trim() || undefined,
      cacheDir: (raw.cacheDir ?? "").trim() || undefined,
      sourceVideoPath: (raw.sourceVideoPath ?? "").trim() || undefined,
      connectionTimeoutMs
    };
  }
  return {
    kind: "livetalking",
    serverUrl: (raw.serverUrl ?? "").trim() || undefined,
    avatarId: (raw.avatarId ?? "").trim() || undefined,
    model: (raw.model ?? "").trim() || undefined,
    transport: normalizeLiveTalkingTransport(raw.transport),
    connectionTimeoutMs
  };
}

export function normalizeLiveTalkingTransport(
  raw: string | null | undefined
): LiveTalkingTransport {
  if (raw === "virtualcam" || raw === "rtmp" || raw === "rtcpush" || raw === "webrtc") {
    return raw;
  }
  return "webrtc";
}

/** Config present enough to attempt a LiveTalking connection. */
export function isLiveTalkingEngineConfigured(settings?: AvatarEngineSettings | null): boolean {
  const s = normalizeAvatarEngine(settings);
  return s.kind === "livetalking" && Boolean(s.serverUrl && s.avatarId);
}

/** MuseTalk local worker configured (models still operator-managed). */
export function isMuseTalkEngineConfigured(settings?: AvatarEngineSettings | null): boolean {
  const s = normalizeAvatarEngine(settings);
  return (
    s.kind === "musetalk-local" &&
    Boolean(s.serverUrl && s.avatarId && s.modelDir && s.sourceVideoPath)
  );
}

/** Any avatar engine that can satisfy AVATAR_* modes when healthy. */
export function isAvatarEngineConfigured(settings?: AvatarEngineSettings | null): boolean {
  return isLiveTalkingEngineConfigured(settings) || isMuseTalkEngineConfigured(settings);
}
