/**
 * Per-account MediaSession speech queues are independent.
 * Mock TTS + silent audio — no NVIDIA / SAPI required in CI.
 */
import { describe, expect, it } from "vitest";
import { MockAudioOutput } from "../../src/main/connectors/media/audio/local-preview-output";
import { MockTtsProvider } from "../../src/main/connectors/media/tts/mock-tts";
import { VoiceMediaSession } from "../../src/main/connectors/media/voice-media-session";
import { defaultMediaProfile } from "../../src/main/connectors/media/media-session-factory";

describe("media session per-account queues", () => {
  it("A and B speak independently; stopSpeech(A) leaves B running", async () => {
    const ttsA = new MockTtsProvider();
    ttsA.delayMs = 40;
    const ttsB = new MockTtsProvider();
    ttsB.delayMs = 40;
    const audioA = new MockAudioOutput();
    audioA.delayMs = 80;
    const audioB = new MockAudioOutput();
    audioB.delayMs = 80;

    const sessionA = new VoiceMediaSession({
      accountId: "acc_a",
      tts: ttsA,
      audio: audioA,
      getVoiceId: () => "mock-a",
      getRate: () => 1
    });
    const sessionB = new VoiceMediaSession({
      accountId: "acc_b",
      tts: ttsB,
      audio: audioB,
      getVoiceId: () => "mock-b",
      getRate: () => 1
    });

    const pA = sessionA.speak("Xin chào A");
    const pB = sessionB.speak("Xin chào B");

    await new Promise((r) => setTimeout(r, 30));
    await sessionA.stopSpeech();

    await Promise.all([pA, pB]);

    expect(sessionB.spoken).toContain("Xin chào B");
    expect(audioB.played.length).toBeGreaterThanOrEqual(1);

    await sessionA.dispose();
    await sessionB.dispose();
  });

  it("serializes two speaks on the same session", async () => {
    const tts = new MockTtsProvider();
    tts.delayMs = 10;
    const audio = new MockAudioOutput();
    audio.delayMs = 10;
    const session = new VoiceMediaSession({
      accountId: "acc_a",
      tts,
      audio,
      getVoiceId: () => defaultMediaProfile("acc_a").voiceId,
      getRate: () => 1
    });

    await Promise.all([session.speak("one"), session.speak("two")]);
    expect(session.spoken).toEqual(["one", "two"]);
    await session.dispose();
  });
});
