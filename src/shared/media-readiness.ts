/**
 * Media Readiness Center — checklist by livestream output mode.
 * Operator-facing statuses; no engine jargon required.
 */
import type { LiveOutputMode } from "./live-output-mode";

export const MEDIA_READINESS_ITEM_IDS = [
  "tts",
  "voice",
  "audioOutput",
  "virtualCable",
  "avatarEngine",
  "avatarProfile",
  "scene",
  "videoOutput",
  "virtualCamera",
  "gpu"
] as const;

export type MediaReadinessItemId = (typeof MEDIA_READINESS_ITEM_IDS)[number];

/** Sẵn sàng / Cần thiết lập / Không bắt buộc / Lỗi */
export type MediaReadinessStatus =
  | "READY"
  | "NEEDS_SETUP"
  | "NOT_REQUIRED"
  | "ERROR";

export type MediaReadinessItem = {
  id: MediaReadinessItemId;
  status: MediaReadinessStatus;
  /** Required for current output mode (blocks dry-run when missing). */
  required: boolean;
  detail?: string;
};

export type MediaReadinessReport = {
  accountId: string;
  outputMode: LiveOutputMode;
  items: MediaReadinessItem[];
  /** True when every required item is READY. */
  readyForMode: boolean;
  blockingIds: MediaReadinessItemId[];
};

/** One-click dry-run phrase (no TikTok). */
export const MEDIA_DRY_RUN_PHRASE = "Đây là bài kiểm tra Khepree Livestream AI.";

export type MediaDryRunResult = {
  accountId: string;
  phrase: string;
  /** Unique marker so multi-account tests can detect cross-talk. */
  token: string;
  audioPlayed: boolean;
  scenePreviewOk: boolean;
  /** Distinct video/scene marker when preview produced a frame. */
  videoToken?: string;
  error?: string;
};

export type MediaMultiDryRunResult = {
  results: MediaDryRunResult[];
  /** All tokens distinct and each account only carries its own token. */
  isolationOk: boolean;
};

/** Measured facts — main process fills; pure evaluate() never invents. */
export type MediaReadinessFacts = {
  ttsOk: boolean;
  ttsError?: string;
  voiceSelected: boolean;
  voiceCount: number;
  /** Local preview or endpoint selected. */
  audioOutputOk: boolean;
  audioOutputError?: string;
  /** Windows endpoint (virtual cable) with device id. */
  virtualCableOk: boolean;
  avatarEngineConfigured: boolean;
  avatarEngineHealthy: boolean;
  avatarEngineError?: string;
  avatarProfileSelected: boolean;
  sceneOk: boolean;
  videoOutputOk: boolean;
  virtualCameraOk: boolean;
  /** true / false / unknown when GPU not measurable. */
  gpuOk: boolean | "unknown";
  gpuDetail?: string;
};

type Need = "required" | "optional";

function needsForMode(mode: LiveOutputMode): Record<MediaReadinessItemId, Need> {
  const allOptional = Object.fromEntries(
    MEDIA_READINESS_ITEM_IDS.map((id) => [id, "optional" as Need])
  ) as Record<MediaReadinessItemId, Need>;

  if (mode === "ASSIST_ONLY") {
    // Media must not block assistant-only.
    return allOptional;
  }

  if (mode === "VOICE_ONLY") {
    return {
      ...allOptional,
      tts: "required",
      voice: "required",
      audioOutput: "required",
      virtualCable: "required"
    };
  }

  if (mode === "AVATAR_PREVIEW") {
    return {
      ...allOptional,
      tts: "required",
      voice: "required",
      avatarEngine: "required",
      avatarProfile: "required",
      scene: "required",
      videoOutput: "required"
    };
  }

  // AVATAR_LIVE — all checklist items required.
  return Object.fromEntries(
    MEDIA_READINESS_ITEM_IDS.map((id) => [id, "required" as Need])
  ) as Record<MediaReadinessItemId, Need>;
}

function statusFrom(
  required: boolean,
  ok: boolean,
  error?: boolean
): MediaReadinessStatus {
  if (error) return "ERROR";
  if (!required) return ok ? "READY" : "NOT_REQUIRED";
  return ok ? "READY" : "NEEDS_SETUP";
}

/** Pure evaluator — unit-tested without Electron. */
export function evaluateMediaReadiness(
  accountId: string,
  outputMode: LiveOutputMode,
  facts: MediaReadinessFacts
): MediaReadinessReport {
  const need = needsForMode(outputMode);

  const specs: Array<{
    id: MediaReadinessItemId;
    ok: boolean;
    error?: boolean;
    detail?: string;
  }> = [
    {
      id: "tts",
      ok: facts.ttsOk,
      error: Boolean(facts.ttsError) && !facts.ttsOk,
      detail: facts.ttsError
    },
    {
      id: "voice",
      ok: facts.voiceSelected || facts.voiceCount > 0,
      detail:
        facts.voiceSelected
          ? undefined
          : facts.voiceCount > 0
            ? undefined
            : "No TTS voices"
    },
    {
      id: "audioOutput",
      ok: facts.audioOutputOk,
      error: Boolean(facts.audioOutputError),
      detail: facts.audioOutputError
    },
    {
      id: "virtualCable",
      ok: facts.virtualCableOk,
      detail: facts.virtualCableOk ? undefined : "No livestream audio endpoint"
    },
    {
      id: "avatarEngine",
      ok: facts.avatarEngineConfigured && facts.avatarEngineHealthy,
      error: Boolean(facts.avatarEngineError),
      detail: facts.avatarEngineError
    },
    {
      id: "avatarProfile",
      ok: facts.avatarProfileSelected
    },
    {
      id: "scene",
      ok: facts.sceneOk
    },
    {
      id: "videoOutput",
      ok: facts.videoOutputOk
    },
    {
      id: "virtualCamera",
      ok: facts.virtualCameraOk
    },
    {
      id: "gpu",
      ok: facts.gpuOk === true || facts.gpuOk === "unknown",
      error: facts.gpuOk === false,
      detail: facts.gpuDetail
    }
  ];

  // For required GPU: unknown counts as NEEDS_SETUP (operator must know), not READY.
  const items: MediaReadinessItem[] = specs.map((s) => {
    const required = need[s.id] === "required";
    let status = statusFrom(required, s.ok, s.error);
    if (s.id === "gpu" && required && facts.gpuOk === "unknown") {
      status = "NEEDS_SETUP";
    }
    // Voice: if voices exist, treat as ready even without explicit selection (SAPI default).
    if (s.id === "voice" && facts.voiceCount > 0 && !s.error) {
      status = required ? "READY" : status === "NOT_REQUIRED" ? "NOT_REQUIRED" : "READY";
    }
    return {
      id: s.id,
      status,
      required,
      detail: s.detail
    };
  });

  const blockingIds = items
    .filter((i) => i.required && i.status !== "READY")
    .map((i) => i.id);

  return {
    accountId,
    outputMode,
    items,
    readyForMode: blockingIds.length === 0,
    blockingIds
  };
}

export function mediaDryRunToken(accountId: string, index: number): string {
  const short = accountId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase() || "ACC";
  return `KHEPREE_TEST_${index + 1}_${short}`;
}

export function mediaDryRunPhrase(token: string): string {
  return `${MEDIA_DRY_RUN_PHRASE} ${token}`;
}

/** Verify multi-account results do not share tokens across accounts. */
export function verifyMediaMultiIsolation(results: MediaDryRunResult[]): boolean {
  if (results.length === 0) return false;
  const tokens = results.map((r) => r.token);
  if (new Set(tokens).size !== tokens.length) return false;
  for (const r of results) {
    if (!r.phrase.includes(r.token)) return false;
    if (r.videoToken && r.videoToken !== r.token) return false;
    for (const other of results) {
      if (other.accountId === r.accountId) continue;
      if (r.phrase.includes(other.token)) return false;
    }
  }
  return results.every((r) => r.audioPlayed && !r.error);
}
