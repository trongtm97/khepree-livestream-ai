/**
 * Audio device collision + voice-stream readiness helpers.
 */
import { describe, expect, it } from "vitest";
import {
  findAudioDeviceCollision,
  isVoiceStreamAudioReady,
  isVoiceStreamMode
} from "../../src/shared/audio-routing";
import { accountStartBlock } from "../../src/renderer/app/account-start-gate";
import type { AccountLiveSnapshot } from "../../src/shared/live-types";

function baseLive(
  patch: Partial<AccountLiveSnapshot> & { accountId: string }
): AccountLiveSnapshot {
  return {
    username: "shop",
    isRunning: false,
    state: "IDLE",
    automationMode: "SUPERVISED_AUTO",
    pendingApprovalCount: 0,
    health: { component: "x", status: "OK", checkedAt: new Date().toISOString() },
    currentProductId: "p1",
    tiktok: {
      accountId: patch.accountId,
      phase: "CONNECTED",
      connected: true,
      eventCount: 0,
      commentsPerMinute: 0,
      reconnectAttempt: 0,
      health: { component: "tiktok", status: "OK", checkedAt: new Date().toISOString() }
    },
    ...patch
  };
}

describe("audio routing collision + readiness", () => {
  it("flags when Shop B picks Shop A's endpoint", () => {
    const hit = findAudioDeviceCollision("acc_b", "device-cable-A", [
      {
        accountId: "acc_a",
        audioOutputType: "windows-endpoint",
        audioOutputDeviceId: "device-cable-A"
      },
      {
        accountId: "acc_b",
        audioOutputType: "local-preview"
      }
    ]);
    expect(hit).toEqual({ deviceId: "device-cable-A", otherAccountId: "acc_a" });
  });

  it("allows distinct endpoints", () => {
    expect(
      findAudioDeviceCollision("acc_b", "device-cable-B", [
        {
          accountId: "acc_a",
          audioOutputType: "windows-endpoint",
          audioOutputDeviceId: "device-cable-A"
        }
      ])
    ).toBeUndefined();
  });

  it("voice-stream without device is not ready; assistant-only is", () => {
    expect(isVoiceStreamMode({ audioOutputType: "windows-endpoint" })).toBe(true);
    expect(
      isVoiceStreamAudioReady({
        audioOutputType: "windows-endpoint",
        audioOutputDeviceId: undefined
      })
    ).toBe(false);
    expect(
      isVoiceStreamAudioReady({
        audioOutputType: "local-preview"
      })
    ).toBe(true);
  });

  it("accountStartBlock: assistant-only OK; incomplete voice-stream blocks", () => {
    expect(
      accountStartBlock(
        baseLive({
          accountId: "a",
          outputMode: "ASSIST_ONLY",
          audioRouting: {
            mode: "assistant-only",
            outputType: "local-preview",
            ready: true
          }
        })
      )
    ).toBeNull();

    expect(
      accountStartBlock(
        baseLive({
          accountId: "a",
          outputMode: "VOICE_ONLY",
          audioRouting: {
            mode: "voice-stream",
            outputType: "windows-endpoint",
            ready: false
          }
        })
      )
    ).toBe("audio_routing");
  });
});
