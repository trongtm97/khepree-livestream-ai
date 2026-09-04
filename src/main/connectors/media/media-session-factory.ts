/**
 * Creates per-account MediaSession (VoiceMediaSession or CompositeMediaSession).
 * Provider kind is injectable (not hard-coded).
 * Each live session gets its own TTS + AudioOutput so cancel/stop does not cross accounts.
 */
import { randomUUID } from "node:crypto";
import type { MediaProfile, TtsProviderId } from "../../../shared/media-contracts";
import { createAudioOutput, type CreateAudioOutputOptions } from "./audio/create-audio-output";
import type { AudioBridgeClient } from "./audio/windows-audio-bridge";
import { MockMediaProvider } from "./mock-media-provider";
import { MockTtsProvider } from "./tts/mock-tts";
import type { TtsProvider } from "./tts/types";
import { createDefaultTtsProvider, WindowsSapiTtsProvider } from "./tts/windows-sapi-tts";
import type { AvatarProvider } from "./avatar/types";
import { CompositeMediaSession } from "./composite-media-session";
import type { MediaSession } from "./types";
import type { VideoOutput } from "./video/types";
import { NullVideoOutput } from "./video/null-video-output";
import { VoiceMediaSession } from "./voice-media-session";

export type MediaSessionFactoryOptions = {
  getProfile: (accountId: string) => MediaProfile;
  /** Shared TTS for listVoices / health (not used for concurrent speak cancel). */
  tts?: TtsProvider;
  /** When true, use silent mock audio (tests). */
  silentAudio?: boolean;
  /** Force mock media (no TTS) — tests. */
  useMockSession?: boolean;
  /** App root for resolving media_audio_bridge.exe. */
  appRoot?: string;
  /** Inject bridge per device (tests). */
  bridgeFactory?: (deviceId: string) => AudioBridgeClient;
  /**
   * Optional avatar engine per account. When set, create() returns CompositeMediaSession.
   * MuseTalk / LiveTalking stay behind AvatarProvider — not in Sales Brain.
   */
  createAvatar?: (accountId: string) => AvatarProvider | undefined;
  createVideo?: (accountId: string) => VideoOutput | undefined;
};

export class MediaSessionFactory {
  private readonly getProfile: (accountId: string) => MediaProfile;
  private readonly catalogTts: TtsProvider;
  private readonly silentAudio: boolean;
  private readonly useMockSession: boolean;
  private readonly audioOpts: CreateAudioOutputOptions;
  private readonly createAvatar?: (accountId: string) => AvatarProvider | undefined;
  private readonly createVideo?: (accountId: string) => VideoOutput | undefined;

  constructor(opts: MediaSessionFactoryOptions) {
    this.getProfile = opts.getProfile;
    this.catalogTts = opts.tts ?? createDefaultTtsProvider();
    this.silentAudio = opts.silentAudio ?? false;
    this.useMockSession = opts.useMockSession ?? false;
    this.createAvatar = opts.createAvatar;
    this.createVideo = opts.createVideo;
    this.audioOpts = {
      silent: this.silentAudio,
      appRoot: opts.appRoot,
      bridgeFactory: opts.bridgeFactory
    };
  }

  /** Catalog / health — not bound to a live speak queue. */
  getTts(): TtsProvider {
    return this.catalogTts;
  }

  private newSpeakTts(): TtsProvider {
    if (this.catalogTts.id === "mock") return new MockTtsProvider();
    if (process.platform === "win32") return new WindowsSapiTtsProvider();
    return new MockTtsProvider();
  }

  /** Profile-aware sink — local-preview or windows-endpoint. */
  createAudioOutput(profile: MediaProfile) {
    return createAudioOutput(profile, this.audioOpts);
  }

  /** New session per live runtime — caller owns dispose. */
  create(accountId: string): MediaSession {
    if (this.useMockSession) return new MockMediaProvider(accountId);

    const profile = this.getProfile(accountId);
    const audio = this.createAudioOutput(profile);
    const avatar = this.createAvatar?.(accountId);
    const voiceOpts = {
      getVoiceId: () => this.getProfile(accountId).voiceId,
      getRate: () => this.getProfile(accountId).rate
    };

    if (avatar) {
      return new CompositeMediaSession({
        accountId,
        tts: this.newSpeakTts(),
        audio,
        avatar,
        video: this.createVideo?.(accountId) ?? new NullVideoOutput(`video-${accountId.slice(0, 8)}`),
        ...voiceOpts
      });
    }

    return new VoiceMediaSession({
      accountId,
      tts: this.newSpeakTts(),
      audio,
      ...voiceOpts
    });
  }

  /** One-shot preview that does not share the live session queue. */
  async preview(accountId: string, text: string): Promise<void> {
    if (this.useMockSession) {
      const mock = new MockMediaProvider(accountId);
      await mock.speak(text);
      await mock.dispose();
      return;
    }
    const profile = this.getProfile(accountId);
    const audio = this.createAudioOutput(profile);
    const session = new VoiceMediaSession({
      accountId: `${accountId}:preview`,
      tts: this.newSpeakTts(),
      audio,
      getVoiceId: () => profile.voiceId,
      getRate: () => profile.rate
    });
    try {
      await session.speak(text);
    } finally {
      await session.dispose();
    }
  }
}

export function defaultMediaProfile(accountId: string): MediaProfile {
  const providerId: TtsProviderId =
    process.platform === "win32" ? "windows-sapi" : "mock";
  return {
    id: `mp_${accountId}`,
    accountId,
    providerId,
    voiceId: undefined,
    rate: 1,
    audioOutputType: "local-preview",
    avatarEngine: { kind: "none" },
    updatedAt: new Date().toISOString()
  };
}

export function newMediaProfileId(): string {
  return `mp_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

/** Test helper factory with mock TTS + silent audio. */
export function createTestMediaSessionFactory(
  getProfile?: (accountId: string) => MediaProfile
): MediaSessionFactory {
  return new MediaSessionFactory({
    getProfile: getProfile ?? ((id) => defaultMediaProfile(id)),
    tts: new MockTtsProvider(),
    silentAudio: true
  });
}
