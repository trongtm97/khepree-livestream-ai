/**
 * Live output mode + MediaCapabilities readiness.
 */
import { describe, expect, it } from "vitest";
import {
  allowsSpeechOutput,
  checkOutputModeLicense,
  isOutputModeReady,
  missingCapabilitiesForMode,
  normalizeLiveOutputMode,
  outputModeRequirements,
  resolveMediaCapabilities
} from "../../src/shared/live-output-mode";
import { accountStartBlock } from "../../src/renderer/app/account-start-gate";
import type { AccountLiveSnapshot } from "../../src/shared/live-types";

function live(patch: Partial<AccountLiveSnapshot> & { accountId: string }): AccountLiveSnapshot {
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

describe("live output mode", () => {
  it("defaults unknown mode to ASSIST_ONLY", () => {
    expect(normalizeLiveOutputMode(undefined)).toBe("ASSIST_ONLY");
    expect(normalizeLiveOutputMode("nope")).toBe("ASSIST_ONLY");
  });

  it("ASSIST_ONLY needs nothing; VOICE_ONLY needs voice+audio; AVATAR_LIVE needs all", () => {
    expect(outputModeRequirements("ASSIST_ONLY")).toEqual({
      needVoice: false,
      needAudioRoute: false,
      needAvatar: false,
      needVideoRoute: false
    });
    expect(outputModeRequirements("VOICE_ONLY").needAudioRoute).toBe(true);
    expect(outputModeRequirements("AVATAR_PREVIEW").needAvatar).toBe(true);
    expect(outputModeRequirements("AVATAR_LIVE")).toEqual({
      needVoice: true,
      needAudioRoute: true,
      needAvatar: true,
      needVideoRoute: true
    });
  });

  it("resolveMediaCapabilities: endpoint device → audioRouteReady", () => {
    const caps = resolveMediaCapabilities({
      ttsStatus: "OK",
      audioOutputType: "windows-endpoint",
      audioOutputDeviceId: "device-cable-A"
    });
    expect(caps.voiceReady).toBe(true);
    expect(caps.audioRouteReady).toBe(true);
    expect(caps.avatarReady).toBe(false);
  });

  it("VOICE_ONLY blocks without audio route; ASSIST_ONLY does not", () => {
    const bare = resolveMediaCapabilities({
      ttsStatus: "OK",
      audioOutputType: "local-preview"
    });
    expect(isOutputModeReady("ASSIST_ONLY", bare)).toBe(true);
    expect(isOutputModeReady("VOICE_ONLY", bare)).toBe(false);
    expect(missingCapabilitiesForMode("VOICE_ONLY", bare)).toContain("audioRouteReady");
  });

  it("allowsSpeechOutput only when not ASSIST_ONLY", () => {
    expect(allowsSpeechOutput("ASSIST_ONLY")).toBe(false);
    expect(allowsSpeechOutput("VOICE_ONLY")).toBe(true);
  });

  it("license hook always allows (no new entitlements yet)", () => {
    expect(checkOutputModeLicense("AVATAR_LIVE", {}).allowed).toBe(true);
  });

  it("accountStartBlock uses mediaCapabilities for output mode", () => {
    expect(
      accountStartBlock(
        live({
          accountId: "a",
          outputMode: "ASSIST_ONLY",
          mediaCapabilities: {
            voiceReady: true,
            audioRouteReady: false,
            avatarReady: false,
            videoRouteReady: false
          }
        })
      )
    ).toBeNull();

    expect(
      accountStartBlock(
        live({
          accountId: "a",
          outputMode: "VOICE_ONLY",
          mediaCapabilities: {
            voiceReady: true,
            audioRouteReady: false,
            avatarReady: false,
            videoRouteReady: false
          }
        })
      )
    ).toBe("output_mode");
  });
});
