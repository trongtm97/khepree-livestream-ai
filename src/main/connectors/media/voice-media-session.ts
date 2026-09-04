/**
 * Voice-only MediaSession: TTS → LocalPreview, serialized speech queue per account.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { RuntimeHealth } from "../../../shared/live-types";
import type { AudioOutput } from "./audio/types";
import type { TtsProvider } from "./tts/types";
import type { MediaSession, SpeakOptions } from "./types";

type QueueItem = {
  text: string;
  options?: SpeakOptions;
  resolve: () => void;
  reject: (err: unknown) => void;
};

export type VoiceMediaSessionOptions = {
  accountId: string;
  tts: TtsProvider;
  audio: AudioOutput;
  getVoiceId?: () => string | undefined;
  getRate?: () => number;
  tempDir?: string;
};

export class VoiceMediaSession implements MediaSession {
  readonly accountId: string;
  sessionId?: string;
  readonly spoken: string[] = [];
  private readonly tts: TtsProvider;
  private readonly audio: AudioOutput;
  private readonly getVoiceId?: () => string | undefined;
  private readonly getRate: () => number;
  private readonly tempDir: string;
  private queue: QueueItem[] = [];
  private pumping = false;
  private disposed = false;
  private generation = 0;
  private scene = "default";

  constructor(opts: VoiceMediaSessionOptions) {
    this.accountId = opts.accountId;
    this.tts = opts.tts;
    this.audio = opts.audio;
    this.getVoiceId = opts.getVoiceId;
    this.getRate = opts.getRate ?? (() => 1);
    this.tempDir = opts.tempDir ?? path.join(os.tmpdir(), "khepree-tts", opts.accountId);
    fs.mkdirSync(this.tempDir, { recursive: true });
  }

  bindSession(sessionId: string | undefined): void {
    this.sessionId = sessionId;
  }

  async health(): Promise<RuntimeHealth> {
    const [ttsH, audioH] = await Promise.all([this.tts.health(), this.audio.health()]);
    const worst =
      ttsH.status === "DOWN" || audioH.status === "DOWN"
        ? "DOWN"
        : ttsH.status === "DEGRADED" || audioH.status === "DEGRADED"
          ? "DEGRADED"
          : ttsH.status === "DISABLED" || audioH.status === "DISABLED"
            ? "DISABLED"
            : "OK";
    return {
      component: `media:voice:${this.accountId.slice(0, 8)}`,
      status: worst,
      message: `tts=${ttsH.message ?? ttsH.status} · audio=${audioH.message ?? audioH.status} · scene=${this.scene}`,
      checkedAt: new Date().toISOString()
    };
  }

  speak(text: string, options?: SpeakOptions): Promise<void> {
    if (this.disposed) return Promise.reject(new Error("MEDIA_DISPOSED"));
    const trimmed = text.trim();
    if (!trimmed) return Promise.resolve();
    return new Promise((resolve, reject) => {
      this.queue.push({ text: trimmed, options, resolve, reject });
      void this.pump();
    });
  }

  async stopSpeech(): Promise<void> {
    this.generation += 1;
    const pending = this.queue;
    this.queue = [];
    for (const item of pending) item.resolve();
    await this.audio.stop();
    await this.tts.cancel?.();
  }

  async interrupt(): Promise<void> {
    // Stop current utterance; leave remaining queue for later high-priority work.
    this.generation += 1;
    await this.audio.stop();
    await this.tts.cancel?.();
  }

  async setScene(scene: string): Promise<void> {
    this.scene = scene || "default";
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    await this.stopSpeech();
    await this.audio.dispose();
    try {
      fs.rmSync(this.tempDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }

  private async pump(): Promise<void> {
    if (this.pumping) return;
    this.pumping = true;
    try {
      while (this.queue.length > 0 && !this.disposed) {
        const item = this.queue.shift()!;
        const gen = this.generation;
        try {
          await this.runOne(item.text, item.options, gen);
          item.resolve();
        } catch (err) {
          if (gen !== this.generation) {
            item.resolve();
          } else {
            item.reject(err);
          }
        }
      }
    } finally {
      this.pumping = false;
      if (this.queue.length > 0 && !this.disposed) void this.pump();
    }
  }

  private async runOne(text: string, options: SpeakOptions | undefined, gen: number): Promise<void> {
    if (gen !== this.generation) return;
    const outPath = path.join(this.tempDir, `utt-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`);
    const voiceId = options?.voiceId ?? this.getVoiceId?.();
    const rate = options?.rate ?? this.getRate();
    try {
      await this.tts.synthesize({ text, voiceId, rate, outPath });
      if (gen !== this.generation) return;
      this.spoken.push(text);
      await this.audio.play(outPath);
    } finally {
      try {
        fs.unlinkSync(outPath);
      } catch {
        /* ignore */
      }
    }
  }
}
