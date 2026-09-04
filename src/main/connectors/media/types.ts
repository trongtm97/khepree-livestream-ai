import type { RuntimeHealth } from "../../../shared/live-types";

export type SpeakOptions = {
  /** Relative rate override for this utterance (0.5–2). */
  rate?: number;
  voiceId?: string;
  /** Reserved: high-priority may interrupt later. */
  priority?: "normal" | "high";
};

/**
 * Per-account media session (voice now; avatar later).
 * One session must not speak two lines at once — implementations queue.
 */
export interface MediaSession {
  readonly accountId: string;
  sessionId?: string;
  bindSession(sessionId: string | undefined): void;
  health(): Promise<RuntimeHealth>;
  speak(text: string, options?: SpeakOptions): Promise<void>;
  stopSpeech(): Promise<void>;
  setScene(scene: string): Promise<void>;
  interrupt(): Promise<void>;
  dispose(): Promise<void>;
}

/**
 * @deprecated Prefer MediaSession. Subset used by LiveOrchestrator today.
 */
export type MediaProvider = Pick<
  MediaSession,
  "health" | "speak" | "stopSpeech" | "setScene"
>;
