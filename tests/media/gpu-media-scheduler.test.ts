/**
 * GpuMediaScheduler — multi-avatar capacity (separate from AiRequestScheduler).
 */
import { describe, expect, it } from "vitest";
import {
  capabilityFromAvatarEngine,
  GpuMediaScheduler
} from "../../src/main/live/gpu-media-scheduler";

describe("GpuMediaScheduler admission", () => {
  it("mock capacity 2: A/B AVATAR_LIVE accepted, C rejected → VOICE_ONLY; C can still be voice", () => {
    const gpu = new GpuMediaScheduler({ maxAvatarSlots: 2 });

    const base = {
      model: "musetalk-local",
      targetFps: 25,
      priority: "speaking" as const,
      estimatedVramMb: 4096,
      qualityTier: "BALANCED" as const,
      capacitySlots: 1,
      modelLoaded: true
    };

    expect(gpu.admitAvatarLive({ ...base, accountId: "acc_a" }).allowed).toBe(true);
    gpu.registerSession({ ...base, accountId: "acc_a" });

    expect(gpu.admitAvatarLive({ ...base, accountId: "acc_b" }).allowed).toBe(true);
    gpu.registerSession({ ...base, accountId: "acc_b" });

    const c = gpu.admitAvatarLive({ ...base, accountId: "acc_c" });
    expect(c.allowed).toBe(false);
    expect(c.code).toBe("GPU_CAPACITY");
    expect(c.suggestedOutputMode).toBe("VOICE_ONLY");

    // C may still run voice-only (no GPU slot).
    expect(gpu.getPublicState().usedSlots).toBe(2);
    gpu.unregisterSession("acc_a");
    expect(gpu.admitAvatarLive({ ...base, accountId: "acc_c" }).allowed).toBe(true);
  });

  it("denies when model not loaded — suggests VOICE_ONLY", () => {
    const gpu = new GpuMediaScheduler({ maxAvatarSlots: 4 });
    const d = gpu.admitAvatarLive({
      accountId: "acc_a",
      model: "musetalk-local",
      targetFps: 25,
      priority: "speaking",
      estimatedVramMb: 4096,
      modelLoaded: false
    });
    expect(d.allowed).toBe(false);
    expect(d.code).toBe("MODEL_NOT_LOADED");
    expect(d.suggestedOutputMode).toBe("VOICE_ONLY");
  });

  it("speaking priority beats idle; idle can use prerecorded frames", () => {
    const gpu = new GpuMediaScheduler({ maxAvatarSlots: 4 });
    gpu.registerSession({
      accountId: "idle_1",
      model: "m",
      targetFps: 25,
      priority: "idle",
      estimatedVramMb: 100,
      supportsIdlePrerecorded: true
    });
    gpu.registerSession({
      accountId: "talk_1",
      model: "m",
      targetFps: 25,
      priority: "speaking",
      estimatedVramMb: 100
    });
    expect(gpu.shouldUseIdlePrerecorded("idle_1")).toBe(true);
    expect(gpu.pickNextInferenceAccount()).toBe("talk_1");
    expect(gpu.pickNextInferenceAccount()).toBe("talk_1");
  });

  it("overload below target FPS is never silent", () => {
    const gpu = new GpuMediaScheduler({ maxAvatarSlots: 2 });
    gpu.registerSession({
      accountId: "acc_a",
      model: "m",
      targetFps: 25,
      priority: "speaking",
      estimatedVramMb: 100,
      qualityTier: "BALANCED"
    });
    const warnings = gpu.reportInferenceFps("acc_a", 12);
    expect(warnings.some((w) => w.code === "FPS_BELOW_TARGET")).toBe(true);
    expect(warnings.some((w) => w.code === "PREVIEW_FPS_REDUCED")).toBe(true);
    expect(warnings.some((w) => w.code === "SUGGEST_LIGHTER_ENGINE")).toBe(true);
    expect(gpu.getPublicState().warnings.length).toBeGreaterThan(0);
  });

  it("VRAM gate when monitor reports free memory", () => {
    const gpu = new GpuMediaScheduler({
      maxAvatarSlots: 10,
      vramHeadroomMb: 256,
      getGpuSnapshot: () => ({
        vendor: "UNKNOWN",
        available: true,
        vramFreeMb: 3000,
        utilizationPercent: 10
      })
    });
    const heavy = gpu.admitAvatarLive({
      accountId: "acc_a",
      model: "m",
      targetFps: 25,
      priority: "speaking",
      estimatedVramMb: 4096
    });
    expect(heavy.allowed).toBe(false);
    expect(heavy.code).toBe("GPU_VRAM");
    expect(heavy.suggestedOutputMode).toBe("VOICE_ONLY");
  });
});

describe("capabilityFromAvatarEngine", () => {
  it("maps provider kind to tiers without GPU brand logic", () => {
    const mt = capabilityFromAvatarEngine({ kind: "musetalk-local", qualityTier: "LIGHT" });
    expect(mt.capacitySlots).toBe(1);
    expect(mt.qualityTier).toBe("LIGHT");
    const lt = capabilityFromAvatarEngine({ kind: "livetalking" });
    expect(lt.capacitySlots).toBe(0);
  });
});
