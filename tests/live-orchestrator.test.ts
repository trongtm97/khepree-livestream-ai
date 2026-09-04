import { afterEach, describe, expect, it } from "vitest";
import { LiveEventBus } from "../src/main/core/event-bus";
import { LiveOrchestrator } from "../src/main/live/live-orchestrator";
import type { AutomationMode } from "../src/shared/live-types";
import { FakeLlmProvider, FakeMediaProvider, makeComment, makeProposal } from "./helpers/fakes";

const cleanups: Array<() => void> = [];

function setup(opts: {
  mode?: AutomationMode;
  llm?: FakeLlmProvider;
  supervisedDelayMs?: number;
} = {}) {
  const bus = new LiveEventBus();
  const llm = opts.llm ?? new FakeLlmProvider();
  const media = new FakeMediaProvider();
  const sessions: Array<{ id: string; mode: AutomationMode; finalState?: string }> = [];
  const approvalChanges: string[] = [];

  const live = new LiveOrchestrator({
    eventBus: bus,
    llm,
    media,
    getCurrentProduct: () => undefined,
    onApprovalChanged: (item) => approvalChanges.push(item ? item.id : "__cleared__"),
    onSessionStart: (id, mode) => sessions.push({ id, mode }),
    onSessionEnd: (id, finalState) => {
      const row = sessions.find((s) => s.id === id);
      if (row) row.finalState = finalState;
    },
    approvalOptions: { supervisedDelayMs: opts.supervisedDelayMs ?? 60 }
  });

  if (opts.mode) live.setMode(opts.mode);
  cleanups.push(() => live.stop());
  return { bus, llm, media, live, sessions, approvalChanges };
}

afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
});

/** Let the orchestrator's async handler and 250ms collector settle. */
function settle(ms = 160) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("LiveOrchestrator — comment intake", () => {
  it("drafts a proposal for a high-intent comment", async () => {
    const { bus, llm, live } = setup({ mode: "MANUAL_ASSIST" });
    live.start();

    bus.publish(makeComment("mua size M còn hàng không?"));
    await settle();

    expect(llm.calls).toHaveLength(1);
    expect(live.listApprovals()).toHaveLength(1);
  });

  it("ignores low-signal comments without calling the LLM", async () => {
    const { bus, llm, live } = setup({ mode: "MANUAL_ASSIST" });
    live.start();

    bus.publish(makeComment("hi"));
    await settle();

    expect(llm.calls).toHaveLength(0);
    expect(live.listApprovals()).toHaveLength(0);
  });

  it("ignores spam comments", async () => {
    const { bus, llm, live } = setup({ mode: "MANUAL_ASSIST" });
    live.start();

    bus.publish(makeComment("aaaaaaaaaaaaaaaaaa"));
    await settle();

    expect(llm.calls).toHaveLength(0);
  });

  it("does nothing before start()", async () => {
    const { bus, llm, live } = setup({ mode: "MANUAL_ASSIST" });
    bus.publish(makeComment("mua size M còn hàng không?"));
    await settle();
    expect(llm.calls).toHaveLength(0);
  });
});

describe("LiveOrchestrator — supervised auto", () => {
  it("auto-approves a confident safe proposal and speaks it", async () => {
    const { bus, media, live } = setup({
      mode: "SUPERVISED_AUTO",
      llm: new FakeLlmProvider(() => makeProposal({ speech: "Dạ cảm ơn bạn đã ủng hộ" }))
    });
    live.start();

    bus.publish(makeComment("mua size M còn hàng không?"));
    await settle(400);

    expect(media.spoken).toEqual(["Dạ cảm ơn bạn đã ủng hộ"]);
    expect(live.listApprovals()).toHaveLength(0);
  });

  it("does NOT auto-approve protected risk tags", async () => {
    const { bus, media, live } = setup({
      mode: "SUPERVISED_AUTO",
      llm: new FakeLlmProvider(() =>
        makeProposal({ speech: "Thuốc này chữa khỏi", riskTags: ["medical"] })
      )
    });
    live.start();

    bus.publish(makeComment("mua size M còn hàng không?"));
    await settle(400);

    expect(media.spoken).toHaveLength(0);
    expect(live.listApprovals()).toHaveLength(1);
    expect(live.listApprovals()[0]?.autoApproveAt).toBeUndefined();
  });

  it("does NOT auto-approve low confidence", async () => {
    const { bus, media, live } = setup({
      mode: "SUPERVISED_AUTO",
      llm: new FakeLlmProvider(() => makeProposal({ confidence: 0.4 }))
    });
    live.start();

    bus.publish(makeComment("mua size M còn hàng không?"));
    await settle(400);

    expect(media.spoken).toHaveLength(0);
    expect(live.listApprovals()).toHaveLength(1);
  });

  it("lets the operator cancel a countdown before it fires", async () => {
    const { bus, media, live } = setup({
      mode: "SUPERVISED_AUTO",
      supervisedDelayMs: 300,
      llm: new FakeLlmProvider(() => makeProposal({ speech: "xin chào" }))
    });
    live.start();

    bus.publish(makeComment("mua size M còn hàng không?"));
    await settle(60);

    const pending = live.listApprovals();
    expect(pending).toHaveLength(1);
    live.cancelAutoApproval(pending[0]!.id);
    await settle(500);

    expect(media.spoken).toHaveLength(0);
    expect(live.listApprovals()).toHaveLength(1);
  });
});

describe("LiveOrchestrator — operator control", () => {
  it("speaks an approved item", async () => {
    const { bus, media, live } = setup({
      mode: "MANUAL_ASSIST",
      llm: new FakeLlmProvider(() => makeProposal({ speech: "Cảm ơn bạn" }))
    });
    live.start();
    bus.publish(makeComment("mua size M còn hàng không?"));
    await settle();

    const item = live.listApprovals()[0]!;
    await live.resolveApproval(item.id, "approve");
    expect(media.spoken).toEqual(["Cảm ơn bạn"]);
  });

  it("speaks the operator's edited text, not the draft", async () => {
    const { bus, media, live } = setup({
      mode: "MANUAL_ASSIST",
      llm: new FakeLlmProvider(() => makeProposal({ speech: "bản nháp" }))
    });
    live.start();
    bus.publish(makeComment("mua size M còn hàng không?"));
    await settle();

    const item = live.listApprovals()[0]!;
    await live.resolveApproval(item.id, "approve", "bản đã sửa");
    expect(media.spoken).toEqual(["bản đã sửa"]);
  });

  it("does not speak a rejected item", async () => {
    const { bus, media, live } = setup({ mode: "MANUAL_ASSIST" });
    live.start();
    bus.publish(makeComment("mua size M còn hàng không?"));
    await settle();

    const item = live.listApprovals()[0]!;
    await live.resolveApproval(item.id, "reject");
    expect(media.spoken).toHaveLength(0);
    expect(live.listApprovals()).toHaveLength(0);
  });

  it("tolerates a late approve click after auto-approval already fired", async () => {
    const { bus, live } = setup({ mode: "SUPERVISED_AUTO", supervisedDelayMs: 40 });
    live.start();
    bus.publish(makeComment("mua size M còn hàng không?"));
    await settle(400);

    const gone = live.listApprovals();
    expect(gone).toHaveLength(0);

    // Simulate a stale UI: operator clicks an id that was already handled.
    await expect(live.resolveApproval("already-gone-id", "approve")).resolves.toBeUndefined();
  });

  it("emergency stop clears the queue, silences speech, and drops to manual", async () => {
    const { bus, media, live } = setup({ mode: "SUPERVISED_AUTO", supervisedDelayMs: 5000 });
    live.start();
    bus.publish(makeComment("mua size M còn hàng không?"));
    bus.publish(makeComment("chốt đơn size L luôn"));
    await settle();

    expect(live.listApprovals().length).toBeGreaterThan(0);
    live.emergencyStop();

    expect(live.listApprovals()).toHaveLength(0);
    expect(live.automationMode).toBe("MANUAL_ASSIST");
    expect(media.stopped).toBeGreaterThan(0);
  });

  it("stopAutomation cancels countdowns and drops to manual", async () => {
    const { bus, media, live } = setup({ mode: "SUPERVISED_AUTO", supervisedDelayMs: 200 });
    live.start();
    bus.publish(makeComment("mua size M còn hàng không?"));
    await settle(60);

    live.stopAutomation();
    expect(live.automationMode).toBe("MANUAL_ASSIST");
    await settle(400);
    expect(media.spoken).toHaveLength(0);
  });
});

describe("LiveOrchestrator — session lifecycle", () => {
  it("records session start and end", () => {
    const { live, sessions } = setup();
    live.start();
    const id = live.sessionId;
    expect(sessions).toEqual([{ id, mode: "SUPERVISED_AUTO" }]);
    expect(live.isRunning).toBe(true);

    live.stop();
    expect(sessions[0]?.finalState).toBe("IDLE");
    expect(live.isRunning).toBe(false);
  });

  it("resets memory so a new session starts clean", async () => {
    const { bus, live } = setup({ mode: "MANUAL_ASSIST" });
    live.start();
    bus.publish(makeComment("mua size M còn hàng không?"));
    await settle();
    live.stop();

    const firstMemory = live.getMemorySnapshot().sessionId;
    live.start();
    expect(live.getMemorySnapshot().sessionId).not.toBe(firstMemory);
    expect(live.getMemorySnapshot().recentSpeech).toEqual([]);
  });

  it("does not carry stale approvals into the next session", async () => {
    const { bus, live } = setup({ mode: "MANUAL_ASSIST" });
    live.start();
    bus.publish(makeComment("mua size M còn hàng không?"));
    await settle();
    expect(live.listApprovals()).toHaveLength(1);

    live.stop();
    expect(live.listApprovals()).toHaveLength(0);

    live.start();
    expect(live.listApprovals()).toHaveLength(0);
  });

  it("ignores duplicate starts", () => {
    const { live, sessions } = setup();
    live.start();
    live.start();
    expect(sessions).toHaveLength(1);
  });
});

describe("LiveOrchestrator — failure isolation", () => {
  it("keeps running when the LLM provider throws", async () => {
    const { bus, media, live } = setup({
      mode: "MANUAL_ASSIST",
      llm: new FakeLlmProvider(() => {
        throw new Error("LLM boom");
      })
    });
    live.start();
    bus.publish(makeComment("mua size M còn hàng không?"));
    await settle();

    // Falls back to ASK_OPERATOR for the human rather than dying.
    const item = live.listApprovals()[0];
    expect(item?.proposal.kind).toBe("ASK_OPERATOR");
    expect(media.spoken).toHaveLength(0);
  });

  it("marks the item FAILED when speaking fails", async () => {
    const { bus, media, live } = setup({ mode: "MANUAL_ASSIST" });
    media.failNext = true;
    live.start();
    bus.publish(makeComment("mua size M còn hàng không?"));
    await settle();

    const item = live.listApprovals()[0]!;
    await live.resolveApproval(item.id, "approve");
    expect(media.spoken).toHaveLength(0);
  });

  it("regenerates near-duplicate speech instead of repeating itself", async () => {
    let call = 0;
    const llm = new FakeLlmProvider(() => {
      call += 1;
      return makeProposal({ speech: call === 1 ? "Mẫu câu trả lời" : "Câu trả lời khác hẳn" });
    });
    const { bus, media, live } = setup({ mode: "MANUAL_ASSIST", llm });
    live.start();

    // First utterance lands in memory...
    bus.publish(makeComment("mua size M còn hàng không?"));
    await settle();
    const first = live.listApprovals()[0]!;
    await live.resolveApproval(first.id, "approve");

    // ...so a second identical draft must be regenerated.
    call = 0;
    bus.publish(makeComment("chốt đơn size L luôn nhé"));
    await settle();
    const second = live.listApprovals()[0]!;
    await live.resolveApproval(second.id, "approve");

    expect(media.spoken).toEqual(["Mẫu câu trả lời", "Câu trả lời khác hẳn"]);
  });
});

describe("LiveOrchestrator — bounded queue", () => {
  it("keeps resolved history bounded over a long stream", async () => {
    const { bus, live } = setup({ mode: "SUPERVISED_AUTO", supervisedDelayMs: 1 });
    live.start();
    for (let i = 0; i < 600; i += 1) {
      bus.publish(makeComment(`mua size M còn hàng không ${i}?`));
    }
    await settle(800);
    expect(live.getQueueStats().retained).toBeLessThanOrEqual(400);
  });

  it("retires pending items the operator can no longer act on", async () => {
    // Short TTL so the test does not wait the production five minutes.
    const bus = new LiveEventBus();
    const staleLive = new LiveOrchestrator({
      eventBus: bus,
      llm: new FakeLlmProvider(),
      media: new FakeMediaProvider(),
      getCurrentProduct: () => undefined,
      approvalOptions: { pendingTtlMs: 50 }
    });
    staleLive.setMode("MANUAL_ASSIST");
    cleanups.push(() => staleLive.stop());

    staleLive.start();
    for (let i = 0; i < 20; i += 1) {
      bus.publish(makeComment(`mua size M còn hàng không ${i}?`));
    }
    await settle(200);

    // Still queued — nothing has expired yet.
    expect(staleLive.listApprovals().length).toBeGreaterThan(0);
    // New traffic triggers the prune, retiring the stale ones.
    await new Promise((r) => setTimeout(r, 120));
    bus.publish(makeComment("mua size M còn hàng không mới?"));
    await settle(200);
    expect(staleLive.getQueueStats().pending).toBeLessThan(20);
  });
});

describe("LiveOrchestrator — Product DNA fail-safe", () => {
  it("refuses to state a size when no product DNA is loaded", async () => {
    const { bus, media, live } = setup({
      mode: "SUPERVISED_AUTO",
      llm: new FakeLlmProvider(() => makeProposal({ speech: "Còn size M nhé bạn" }))
    });
    live.start();
    bus.publish(makeComment("mua size M còn hàng không?"));
    await settle(400);

    // Ungrounded size claim must not reach the speaker.
    expect(media.spoken).toHaveLength(0);
    const item = live.listApprovals()[0];
    expect(item?.proposal.kind).toBe("ASK_OPERATOR");
  });

  it("refuses an invented price when no product DNA is loaded", async () => {
    const { bus, media, live } = setup({
      mode: "SUPERVISED_AUTO",
      llm: new FakeLlmProvider(() => makeProposal({ speech: "Giá chỉ 299k thôi bạn" }))
    });
    live.start();
    bus.publish(makeComment("mua size M còn hàng không?"));
    await settle(400);

    expect(media.spoken).toHaveLength(0);
    expect(live.listApprovals()[0]?.proposal.kind).toBe("ASK_OPERATOR");
  });

  it("allows the same size claim once Product DNA grounds it", async () => {
    const { bus, media } = setup({
      mode: "SUPERVISED_AUTO",
      llm: new FakeLlmProvider(() => makeProposal({ speech: "Còn size M nhé bạn" }))
    });
    const bus2 = new LiveEventBus();
    const product = {
      id: "p1",
      title: "Áo thun",
      facts: [],
      benefits: [],
      sizes: ["M"],
      colors: [],
      variants: [],
      faq: [],
      allowedClaims: [],
      forbiddenClaims: [],
      updatedAt: new Date().toISOString()
    };
    const localLive = new LiveOrchestrator({
      eventBus: bus2,
      llm: new FakeLlmProvider(() => makeProposal({ speech: "Còn size M nhé bạn" })),
      media,
      getCurrentProduct: () => product,
      approvalOptions: { supervisedDelayMs: 40 }
    });
    localLive.setMode("SUPERVISED_AUTO");
    cleanups.push(() => localLive.stop());
    localLive.start();

    bus2.publish(makeComment("mua size M còn hàng không?"));
    await settle(400);

    expect(media.spoken).toEqual(["Còn size M nhé bạn"]);
  });
});
