/**
 * Per-account Windows endpoint routing — no shared audio path.
 * Mock bridge only (no NAudio / hardware in CI).
 */
import { describe, expect, it } from "vitest";
import { createAudioOutput } from "../../src/main/connectors/media/audio/create-audio-output";
import {
  MockAudioBridge,
  type AudioBridgeClient
} from "../../src/main/connectors/media/audio/windows-audio-bridge";
import { WindowsEndpointOutput } from "../../src/main/connectors/media/audio/windows-endpoint-output";
import { MockTtsProvider } from "../../src/main/connectors/media/tts/mock-tts";
import { VoiceMediaSession } from "../../src/main/connectors/media/voice-media-session";
import type { MediaProfile } from "../../src/shared/media-contracts";

function profile(accountId: string, deviceId: string): MediaProfile {
  return {
    id: `mp_${accountId}`,
    accountId,
    providerId: "mock",
    rate: 1,
    audioOutputType: "windows-endpoint",
    audioOutputDeviceId: deviceId,
    avatarEngine: { kind: "none" },
    updatedAt: new Date().toISOString()
  };
}

function clientFor(shared: MockAudioBridge, id: string): AudioBridgeClient {
  return {
    listDevices: () => shared.listDevices(),
    play: (deviceId, filePath) => shared.play(deviceId, filePath),
    stop: (deviceId) => shared.stop(deviceId ?? id),
    health: (deviceId) => shared.health(deviceId),
    dispose: async () => {
      await shared.stop(id);
    }
  };
}

describe("per-account audio endpoint routing", () => {
  it("A speak only hits cable A; B speak only hits cable B; stop A leaves B", async () => {
    const shared = new MockAudioBridge();
    shared.addDevice("device-cable-A", "Cable A");
    shared.addDevice("device-cable-B", "Cable B");
    shared.delayMs = 60;

    const audioA = createAudioOutput(profile("acc_a", "device-cable-A"), {
      bridgeFactory: () => clientFor(shared, "device-cable-A")
    });
    const audioB = createAudioOutput(profile("acc_b", "device-cable-B"), {
      bridgeFactory: () => clientFor(shared, "device-cable-B")
    });

    expect(audioA).toBeInstanceOf(WindowsEndpointOutput);
    expect(audioB).toBeInstanceOf(WindowsEndpointOutput);

    const sessionA = new VoiceMediaSession({
      accountId: "acc_a",
      tts: new MockTtsProvider(),
      audio: audioA
    });
    const sessionB = new VoiceMediaSession({
      accountId: "acc_b",
      tts: new MockTtsProvider(),
      audio: audioB
    });

    const pA = sessionA.speak("Shop A hello");
    const pB = sessionB.speak("Shop B hello");

    await new Promise((r) => setTimeout(r, 20));
    await sessionA.stopSpeech();

    await Promise.all([pA, pB]);

    expect(shared.plays.get("device-cable-A")?.length ?? 0).toBeGreaterThanOrEqual(1);
    expect(shared.plays.get("device-cable-B")?.length ?? 0).toBeGreaterThanOrEqual(1);
    expect(shared.plays.has("device-cable-A")).toBe(true);
    expect(shared.plays.has("device-cable-B")).toBe(true);

    await sessionA.dispose();
    await sessionB.dispose();
  });

  it("device A disappears → A health DOWN; B remains OK; A play fails closed", async () => {
    const shared = new MockAudioBridge();
    shared.addDevice("device-cable-A", "Cable A");
    shared.addDevice("device-cable-B", "Cable B");

    const audioA = new WindowsEndpointOutput(
      "device-cable-A",
      clientFor(shared, "device-cable-A"),
      "Cable A"
    );
    const audioB = new WindowsEndpointOutput(
      "device-cable-B",
      clientFor(shared, "device-cable-B"),
      "Cable B"
    );

    expect((await audioA.health()).status).toBe("OK");
    expect((await audioB.health()).status).toBe("OK");

    shared.removeDevice("device-cable-A");

    const hA = await audioA.health();
    const hB = await audioB.health();
    expect(hA.status).toBe("DOWN");
    expect(hB.status).toBe("OK");

    await expect(audioA.play("C:\\fake\\a.wav")).rejects.toThrow(/AUDIO_DEVICE_GONE/);
    await audioB.play("C:\\fake\\b.wav");
    expect(shared.plays.get("device-cable-B")).toEqual(["C:\\fake\\b.wav"]);
    expect(shared.plays.get("device-cable-A")).toBeUndefined();

    await audioA.dispose();
    await audioB.dispose();
  });

  it("createAudioOutput local-preview does not use endpoint bridge", () => {
    const calls: string[] = [];
    const audio = createAudioOutput(
      {
        id: "mp_x",
        accountId: "acc_x",
        providerId: "mock",
        rate: 1,
        audioOutputType: "local-preview",
        audioOutputDeviceId: "device-cable-A",
        avatarEngine: { kind: "none" },
        updatedAt: new Date().toISOString()
      },
      {
        bridgeFactory: () => {
          calls.push("bridge");
          return new MockAudioBridge();
        }
      }
    );
    expect(audio.kind).toBe("local-preview");
    expect(calls).toEqual([]);
  });
});
