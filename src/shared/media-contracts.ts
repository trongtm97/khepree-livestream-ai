/** Public, renderer-safe view of the media/voice output layer. */

export type MediaOutputMode = "mock" | "system-tts";

export type MediaPublicState = {
  /** Which adapter is currently wired to the orchestrator. */
  mode: MediaOutputMode;
  /**
   * Operator kill-switch for AI voice. When false the AI keeps drafting but
   * nothing is spoken — this is the "human takeover microphone" state.
   */
  voiceEnabled: boolean;
  engineAvailable: boolean;
  engine: string;
  message: string;
  hint: string;
  voices: string[];
  selectedVoice?: string;
  speaking: boolean;
  queued: number;
  lastSpokenAt?: string;
  lastError?: string;
  /** Scene switching (OBS/virtual camera) is not implemented in this build. */
  sceneSupported: boolean;
  lastScene?: string;
};

export const DEFAULT_MEDIA_PUBLIC_STATE: MediaPublicState = {
  mode: "mock",
  voiceEnabled: true,
  engineAvailable: false,
  engine: "none",
  message: "",
  hint: "",
  voices: [],
  speaking: false,
  queued: 0,
  sceneSupported: false
};
