/**
 * Media readiness — mode mapping + multi-account isolation tokens.
 */
import { describe, expect, it } from "vitest";
import {
  evaluateMediaReadiness,
  mediaDryRunPhrase,
  mediaDryRunToken,
  MEDIA_DRY_RUN_PHRASE,
  verifyMediaMultiIsolation,
  type MediaDryRunResult,
  type MediaReadinessFacts
} from "../../src/shared/media-readiness";

const readyFacts: MediaReadinessFacts = {
  ttsOk: true,
  voiceSelected: true,
  voiceCount: 3,
  audioOutputOk: true,
  virtualCableOk: true,
  avatarEngineConfigured: true,
  avatarEngineHealthy: true,
  avatarProfileSelected: true,
  sceneOk: true,
  videoOutputOk: true,
  virtualCameraOk: true,
  gpuOk: true
};

describe("evaluateMediaReadiness", () => {
  it("ASSIST_ONLY never blocks on media", () => {
    const empty: MediaReadinessFacts = {
      ttsOk: false,
      voiceSelected: false,
      voiceCount: 0,
      audioOutputOk: false,
      virtualCableOk: false,
      avatarEngineConfigured: false,
      avatarEngineHealthy: false,
      avatarProfileSelected: false,
      sceneOk: false,
      videoOutputOk: false,
      virtualCameraOk: false,
      gpuOk: "unknown"
    };
    const r = evaluateMediaReadiness("a", "ASSIST_ONLY", empty);
    expect(r.readyForMode).toBe(true);
    expect(r.blockingIds).toEqual([]);
    expect(r.items.every((i) => i.status === "NOT_REQUIRED" || i.status === "READY")).toBe(
      true
    );
  });

  it("VOICE_ONLY requires TTS + voice + audio + virtual cable", () => {
    const r = evaluateMediaReadiness("a", "VOICE_ONLY", {
      ...readyFacts,
      virtualCableOk: false
    });
    expect(r.readyForMode).toBe(false);
    expect(r.blockingIds).toContain("virtualCable");
    expect(r.items.find((i) => i.id === "avatarEngine")?.status).toBe("READY");
    // avatar not required — if configured ready shows READY; when not configured:
    const soft = evaluateMediaReadiness("a", "VOICE_ONLY", {
      ...readyFacts,
      avatarEngineConfigured: false,
      avatarEngineHealthy: false,
      avatarProfileSelected: false
    });
    expect(soft.items.find((i) => i.id === "avatarEngine")?.status).toBe("NOT_REQUIRED");
    expect(soft.readyForMode).toBe(true);
  });

  it("AVATAR_PREVIEW requires TTS + avatar + preview scene/video", () => {
    const r = evaluateMediaReadiness("a", "AVATAR_PREVIEW", {
      ...readyFacts,
      avatarProfileSelected: false,
      virtualCableOk: false,
      virtualCameraOk: false
    });
    expect(r.blockingIds).toContain("avatarProfile");
    expect(r.items.find((i) => i.id === "virtualCable")?.required).toBe(false);
  });

  it("AVATAR_LIVE requires all checklist items", () => {
    const r = evaluateMediaReadiness("a", "AVATAR_LIVE", {
      ...readyFacts,
      gpuOk: "unknown"
    });
    expect(r.readyForMode).toBe(false);
    expect(r.blockingIds).toContain("gpu");
    expect(r.items.every((i) => i.required)).toBe(true);
  });
});

describe("multi dry-run isolation", () => {
  it("uses fixed Vietnamese test phrase with unique tokens", () => {
    const t0 = mediaDryRunToken("acc_a", 0);
    const t1 = mediaDryRunToken("acc_b", 1);
    expect(t0).not.toBe(t1);
    expect(mediaDryRunPhrase(t0).startsWith(MEDIA_DRY_RUN_PHRASE)).toBe(true);
    expect(mediaDryRunPhrase(t0)).toContain(t0);
  });

  it("A/B/C isolation passes only when tokens do not cross", () => {
    const mk = (id: string, i: number): MediaDryRunResult => {
      const token = mediaDryRunToken(id, i);
      return {
        accountId: id,
        token,
        phrase: mediaDryRunPhrase(token),
        audioPlayed: true,
        scenePreviewOk: true,
        videoToken: token
      };
    };
    const ok = [mk("acc_a", 0), mk("acc_b", 1), mk("acc_c", 2)];
    expect(verifyMediaMultiIsolation(ok)).toBe(true);

    const mixed = [...ok];
    mixed[2] = {
      ...mixed[2]!,
      phrase: mediaDryRunPhrase(ok[0]!.token),
      token: ok[0]!.token
    };
    expect(verifyMediaMultiIsolation(mixed)).toBe(false);
  });
});
