import type { RuntimeHealth } from "../../../shared/live-types";
import type { MediaPublicState, MediaOutputMode } from "../../../shared/media-contracts";
import type { MediaProvider } from "./types";
import { MockMediaProvider } from "./mock-media-provider";
import { clampSpeechLength, SystemTtsProvider, type SystemTtsOptions } from "./system-tts-provider";

export interface MediaManagerOptions {
  /** Persist operator choices (voice, mute) across restarts. */
  getVoiceHint: () => string | undefined;
  setVoiceHint: (voice: string | undefined) => void;
  getVoiceEnabled: () => boolean;
  setVoiceEnabled: (enabled: boolean) => void;
  ttsOptions?: SystemTtsOptions;
  /** Inject a provider for tests — defaults to the OS speech engine. */
  ttsFactory?: () => SystemTtsProvider;
}

const MAX_SPEECH_CHARS = 500;

/**
 * Owns the media/voice output layer.
 *
 * Responsibilities beyond simply forwarding `speak()`:
 *  - Switch between the silent mock adapter and the OS speech engine.
 *  - Honour the operator's voice kill-switch (human takeover).
 *  - Cap utterance length so a runaway model cannot talk for minutes.
 *  - Expose speaking/queued/error state so the console stays honest about
 *    what is actually being said on stream.
 */
export class MediaManager implements MediaProvider {
  readonly mock = new MockMediaProvider();
  readonly tts: SystemTtsProvider;
  private mode: MediaOutputMode = "mock";
  private scene?: string;
  private lastSpokenAt?: string;
  private lastError?: string;
  private detected = false;

  constructor(private readonly opts: MediaManagerOptions) {
    this.tts = opts.ttsFactory?.() ?? new SystemTtsProvider(opts.ttsOptions ?? {});
  }

  /** Probe the OS engine once and promote to real TTS when it is usable. */
  async initialize(): Promise<void> {
    if (this.detected) return;
    this.detected = true;
    try {
      const info = await this.tts.detect(false);
      this.mode = info.available ? "system-tts" : "mock";
      this.lastError = info.available ? undefined : info.message;
    } catch (error) {
      this.mode = "mock";
      this.lastError = String(error instanceof Error ? error.message : error);
    }
  }

  get outputMode(): MediaOutputMode {
    return this.mode;
  }

  async refreshEngine(): Promise<MediaPublicState> {
    this.detected = true;
    try {
      const info = await this.tts.detect(false);
      this.mode = info.available ? "system-tts" : "mock";
      this.lastError = info.available ? undefined : info.message;
    } catch (error) {
      this.mode = "mock";
      this.lastError = String(error instanceof Error ? error.message : error);
    }
    return this.getPublicState();
  }

  setVoice(voice: string | undefined): void {
    this.opts.setVoiceHint(voice?.trim() || undefined);
  }

  setVoiceEnabled(enabled: boolean): void {
    this.opts.setVoiceEnabled(enabled);
    if (!enabled) void this.stopSpeech();
  }

  get voiceEnabled(): boolean {
    return this.opts.getVoiceEnabled();
  }

  async speak(text: string): Promise<void> {
    // Human takeover: the operator muted AI voice, so never open a speaker.
    if (!this.opts.getVoiceEnabled()) return;

    const safe = clampSpeechLength(text, MAX_SPEECH_CHARS);
    if (!safe) return;

    // No engine (or engine failed below): log the line without sound so the
    // operator can still read what the AI wanted to say.
    const logOnly = async (): Promise<void> => {
      try {
        await this.mock.speak(safe);
      } catch {
        // The silent logger must never break the show either.
      }
    };

    if (this.mode !== "system-tts") {
      await logOnly();
      this.lastSpokenAt = new Date().toISOString();
      this.lastError = undefined;
      return;
    }

    try {
      await this.tts.speak(safe);
      this.lastSpokenAt = new Date().toISOString();
      this.lastError = undefined;
    } catch (error) {
      this.lastError = String(error instanceof Error ? error.message : error);
      // Never let a TTS failure bubble into the orchestrator/approval flow —
      // the show must go on even if the speaker is unavailable.
      console.error("[media] speak failed:", this.lastError);
      await logOnly();
    }
  }

  async stopSpeech(): Promise<void> {
    try {
      await this.tts.stopSpeech();
    } catch {
      /* ignore */
    }
    await this.mock.stopSpeech().catch(() => undefined);
  }

  async setScene(scene: string): Promise<void> {
    // Scene switching needs the virtual camera / OBS bridge, which is not part
    // of this build. Record it so the UI can show what the AI asked for.
    this.scene = scene;
    await this.mock.setScene(scene).catch(() => undefined);
  }

  async health(): Promise<RuntimeHealth> {
    const state = this.getPublicState();
    const checkedAt = new Date().toISOString();
    if (state.mode === "system-tts" && state.engineAvailable) {
      return {
        component: "media:system-tts",
        status: state.voiceEnabled ? "OK" : "DISABLED",
        message: state.voiceEnabled
          ? `Giọng hệ thống sẵn sàng (${state.engine})`
          : "Đang tắt tiếng AI (người dùng đang nói)",
        checkedAt
      };
    }
    return {
      component: "media:mock",
      status: "DISABLED",
      message: state.lastError || "Chưa có giọng đọc — AI chỉ soạn lời, chưa phát ra",
      checkedAt
    };
  }

  getPublicState(): MediaPublicState {
    const info = this.tts.engineInfoCache;
    const voices = info?.voices ?? [];
    return {
      mode: this.mode,
      voiceEnabled: this.opts.getVoiceEnabled(),
      engineAvailable: this.mode === "system-tts",
      engine: info?.engine ?? "none",
      message: info?.message ?? "",
      hint: info?.hint ?? "",
      voices,
      selectedVoice: this.opts.getVoiceHint(),
      speaking: this.tts.isSpeaking,
      queued: this.tts.pendingCount,
      lastSpokenAt: this.lastSpokenAt,
      lastError: this.lastError,
      sceneSupported: false,
      lastScene: this.scene
    };
  }

  async dispose(): Promise<void> {
    await this.stopSpeech();
  }
}
