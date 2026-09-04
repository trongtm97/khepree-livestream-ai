/**
 * Mock avatar A/B isolation — speech for A never drives B; stop A leaves B.
 */
import { describe, expect, it } from "vitest";
import { MockAudioOutput } from "../../src/main/connectors/media/audio/local-preview-output";
import { MockAvatarProvider } from "../../src/main/connectors/media/avatar/mock-avatar-provider";
import { CompositeMediaSession } from "../../src/main/connectors/media/composite-media-session";
import { MockTtsProvider } from "../../src/main/connectors/media/tts/mock-tts";
import { NullVideoOutput } from "../../src/main/connectors/media/video/null-video-output";
import type { AvatarProfile } from "../../src/shared/media-contracts";

function profile(id: string, name: string): AvatarProfile {
  return {
    id,
    name,
    providerId: "mock",
    sourceAssetPath: `/assets/${id}.png`,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  };
}

describe("avatar provider A/B isolation", () => {
  it("A speech only drives avatar A; B only B; stop A does not stop B", async () => {
    const avatarA = new MockAvatarProvider();
    const avatarB = new MockAvatarProvider();
    await avatarA.initialize(profile("av_a", "Avatar A"));
    await avatarB.initialize(profile("av_b", "Avatar B"));

    const ttsA = new MockTtsProvider();
    ttsA.delayMs = 30;
    const ttsB = new MockTtsProvider();
    ttsB.delayMs = 30;
    const audioA = new MockAudioOutput();
    audioA.delayMs = 80;
    const audioB = new MockAudioOutput();
    audioB.delayMs = 80;

    const sessionA = new CompositeMediaSession({
      accountId: "acc_a",
      tts: ttsA,
      audio: audioA,
      avatar: avatarA,
      video: new NullVideoOutput("video-a")
    });
    const sessionB = new CompositeMediaSession({
      accountId: "acc_b",
      tts: ttsB,
      audio: audioB,
      avatar: avatarB,
      video: new NullVideoOutput("video-b")
    });

    sessionA.bindSession("sess_a");
    sessionB.bindSession("sess_b");

    const pA = sessionA.speak("Shop A hello");
    const pB = sessionB.speak("Shop B hello");

    await new Promise((r) => setTimeout(r, 25));
    await sessionA.stopSpeech();

    await Promise.all([pA, pB]);

    // B must complete; A's push may be cancelled by stopSpeech.
    expect(avatarB.pushedAudio.length).toBeGreaterThanOrEqual(1);
    expect(sessionB.spoken).toContain("Shop B hello");
    expect(audioB.played.length).toBeGreaterThanOrEqual(1);
    expect(avatarB.status).toBe("READY");
    // No cross-talk: none of B's paths appear on A.
    for (const p of avatarB.pushedAudio) {
      expect(avatarA.pushedAudio).not.toContain(p);
    }

    await sessionA.dispose();
    await sessionB.dispose();

    expect(avatarA.sessionStopped).toBe(true);
    expect(avatarB.sessionStopped).toBe(true);
  });

  it("same WAV path is fanned to audio and avatar (single TTS source)", async () => {
    const avatar = new MockAvatarProvider();
    await avatar.initialize(profile("av_x", "X"));

    const audio = new MockAudioOutput();
    const session = new CompositeMediaSession({
      accountId: "acc_x",
      tts: new MockTtsProvider(),
      audio,
      avatar,
      video: new NullVideoOutput()
    });
    session.bindSession("s1");

    await session.speak("Lip sync one source");

    expect(session.spoken).toEqual(["Lip sync one source"]);
    expect(audio.played.length).toBe(1);
    expect(avatar.pushedAudio.length).toBe(1);
    expect(avatar.lastPushedPath).toBeTruthy();
    expect(audio.played[0]).toBe(avatar.lastPushedPath);

    await session.dispose();
  });
});
