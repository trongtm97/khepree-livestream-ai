/**
 * Higher-layer MediaSession: TTS WAV fans out to AudioOutput + AvatarProvider.
 * Keeps VoiceMediaSession small; Sales Brain still only sees media.speak / setScene.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { RuntimeHealth } from "../../../shared/live-types";
import type { AudioOutput } from "./audio/types";
import type { AvatarProvider } from "./avatar/types";
import { avatarHealthToRuntimeStatus } from "./avatar/types";
import type { TtsProvider } from "./tts/types";
import type { MediaSession, SpeakOptions } from "./types";
import type { VideoOutput } from "./video/types";

type QueueItem = {
  text: string;
  options?: SpeakOptions;
  resolve: () => void;
  reject: (err: unknown) => void;
};

export type CompositeMediaSessionOptions = {
  accountId: string;
  tts: TtsProvider;
  audio: AudioOutput;
  avatar: AvatarProvider;
  video: VideoOutput;
  getVoiceId?: () => string | undefined;
  getRate?: () => number;
  tempDir?: string;
};

function worstStatus(
  statuses: Array<RuntimeHealth["status"]>
): RuntimeHealth["status"] {
  if (statuses.includes("DOWN")) return "DOWN";
  if (statuses.includes("DEGRADED")) return "DEGRADED";
  if (statuses.includes("DISABLED")) return "DISABLED";
  return "OK";
}

export class CompositeMediaSession implements MediaSession {
  readonly accountId: string;
  sessionId?: string;
  readonly spoken: string[] = [];
  private readonly tts: TtsProvider;
  private readonly audio: AudioOutput;
  private readonly avatar: AvatarProvider;
  private readonly video: VideoOutput;
  private readonly getVoiceId?: () => string | undefined;
  private readonly getRate: () => number;
  private readonly tempDir: string;
  private queue: QueueItem[] = [];
  private pumping = false;
  private disposed = false;
  private generation = 0;
  private scene = "default";
  private avatarSessionStarted = false;

  constructor(opts: CompositeMediaSessionOptions) {
    this.accountId = opts.accountId;
    this.tts = opts.tts;
    this.audio = opts.audio;
    this.avatar = opts.avatar;
    this.video = opts.video;
    this.getVoiceId = opts.getVoiceId;
    this.getRate = opts.getRate ?? (() => 1);
    this.tempDir = opts.tempDir ?? path.join(os.tmpdir(), "khepree-tts", opts.accountId);
    fs.mkdirSync(this.tempDir, { recursive: true });
  }

  bindSession(sessionId: string | undefined): void {
    this.sessionId = sessionId;
    if (sessionId) {
      void this.ensureAvatarSession(sessionId);
    }
  }

  async health(): Promise<RuntimeHealth> {
    const [ttsH, audioH, avatarH, videoH] = await Promise.all([
      this.tts.health(),
      this.audio.health(),
      this.avatar.health(),
      this.video.health()
    ]);
    const avatarRuntime = avatarHealthToRuntimeStatus(avatarH.status);
    return {
      component: `media:composite:${this.accountId.slice(0, 8)}`,
      status: worstStatus([ttsH.status, audioH.status, avatarRuntime, videoH.status]),
      message: `tts=${ttsH.status} · audio=${audioH.status} · avatar=${avatarH.status} · video=${videoH.status} · scene=${this.scene}`,
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
    await Promise.all([this.audio.stop(), this.avatar.interrupt(), this.tts.cancel?.()]);
  }

  async interrupt(): Promise<void> {
    this.generation += 1;
    await Promise.all([this.audio.stop(), this.avatar.interrupt(), this.tts.cancel?.()]);
  }

  async setScene(scene: string): Promise<void> {
    this.scene = scene || "default";
    const s = this.scene.toLowerCase();
    if (s === "default" || s === "idle") {
      await this.avatar.setIdle();
    } else {
      await this.avatar.setGesture(this.scene);
    }
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    await this.stopSpeech();
    await this.avatar.stopSession();
    this.avatarSessionStarted = false;
    await Promise.all([this.audio.dispose(), this.avatar.dispose(), this.video.dispose()]);
    try {
      fs.rmSync(this.tempDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }

  private async ensureAvatarSession(sessionId: string): Promise<void> {
    if (this.avatarSessionStarted) return;
    await this.avatar.startSession({ accountId: this.accountId, sessionId });
    await this.video.start();
    this.avatarSessionStarted = true;
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
          if (gen !== this.generation) item.resolve();
          else item.reject(err);
        }
      }
    } finally {
      this.pumping = false;
      if (this.queue.length > 0 && !this.disposed) void this.pump();
    }
  }

  private async runOne(
    text: string,
    options: SpeakOptions | undefined,
    gen: number
  ): Promise<void> {
    if (gen !== this.generation) return;
    const sid = this.sessionId ?? `local_${randomUUID().slice(0, 8)}`;
    await this.ensureAvatarSession(sid);

    const outPath = path.join(
      this.tempDir,
      `utt-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`
    );
    const voiceId = options?.voiceId ?? this.getVoiceId?.();
    const rate = options?.rate ?? this.getRate();
    try {
      await this.tts.synthesize({ text, voiceId, rate, outPath });
      if (gen !== this.generation) return;
      this.spoken.push(text);
      // One WAV → both sinks (lip-sync). Avatar must not synthesize its own TTS.
      await Promise.all([
        this.audio.play(outPath),
        this.avatar.pushAudio({ path: outPath, format: "wav" })
      ]);
    } finally {
      try {
        fs.unlinkSync(outPath);
      } catch {
        /* ignore */
      }
    }
  }
}
