import type { RuntimeHealth } from "../../../../shared/live-types";
import type { TtsProviderId, TtsVoiceInfo } from "../../../../shared/media-contracts";

export type TtsSynthesizeInput = {
  text: string;
  voiceId?: string;
  /** Relative rate 0.5–2. */
  rate?: number;
  /** Absolute path for WAV (or other) output. */
  outPath: string;
};

export type TtsSynthesizeResult = {
  path: string;
  format: "wav";
};

/**
 * Pluggable TTS engine. Do not hard-code a single vendor in call sites.
 * License note: prefer local OS / Apache engines for commercial streams;
 * edge-tts is NOT registered here (Microsoft ToS for redistribution unclear).
 */
export interface TtsProvider {
  readonly id: TtsProviderId;
  health(): Promise<RuntimeHealth>;
  listVoices(): Promise<TtsVoiceInfo[]>;
  synthesize(input: TtsSynthesizeInput): Promise<TtsSynthesizeResult>;
  /** Cancel in-flight synthesis when the engine supports it. */
  cancel?(): Promise<void>;
}
