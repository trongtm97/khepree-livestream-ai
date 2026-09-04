/** Public media / TTS contracts (renderer-safe). */

export type TtsProviderId = "windows-sapi" | "mock";

export type TtsVoiceInfo = {
  id: string;
  name: string;
  locale?: string;
  gender?: string;
};

export type MediaProfile = {
  id: string;
  accountId: string;
  providerId: TtsProviderId;
  voiceId?: string;
  /** 0.5–2.0 relative speaking rate (1 = normal). */
  rate: number;
  updatedAt: string;
};

export type MediaEnginePublicState = {
  providerId: TtsProviderId;
  status: "OK" | "DEGRADED" | "DOWN" | "UNKNOWN";
  message: string;
  voiceCount: number;
  checkedAt: string;
};
