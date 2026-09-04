import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import type { ActionProposal, LiveEvent, ProductDNA } from "../../src/shared/live-types";
import type { LlmContext, LlmProvider } from "../../src/main/connectors/llm/types";
import type { MediaProvider } from "../../src/main/connectors/media/types";
import { LiveEventBus } from "../../src/main/core/event-bus";
import { LiveOrchestrator } from "../../src/main/live/live-orchestrator";
import { AiRequestScheduler } from "../../src/main/live/ai-request-scheduler";
import { sleep } from "../helpers/harness";

const product: ProductDNA = {
  id: "p1",
  title: "Ao thun",
  facts: [],
  benefits: [],
  sizes: ["M"],
  colors: [],
  variants: [],
  faq: [],
  allowedClaims: [],
  forbiddenClaims: [],
  priceText: "199000",
  currency: "VND",
  shippingText: "2-3 ngay",
  updatedAt: new Date().toISOString()
};

function commentEvent(accountId: string, text: string, sessionId?: string): LiveEvent {
  return {
    id: randomUUID(),
    sequence: 1,
    type: "COMMENT",
    source: "operator",
    timestamp: new Date().toISOString(),
    accountId,
    sessionId,
    username: "buyer",
    displayName: "Buyer",
    text
  };
}

function speakProposal(eventId: string, speech: string): ActionProposal {
  return {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    eventId,
    kind: "SPEAK",
    speech,
    confidence: 0.95,
    reason: "test",
    riskTags: [],
    nextState: "COMMENT_REPLY"
  };
}

class DelayedLlm implements LlmProvider {
  delayMs = 2000;
  callCount = 0;
  private gate?: Promise<void>;
  private releaseGate?: () => void;
  proposalFactory: (ctx: LlmContext, call: number) => ActionProposal = (ctx) =>
    speakProposal(ctx.event.id, "Cam on ban da quan tam san pham nay nhe");

  hold(): void {
    this.gate = new Promise((resolve) => {
      this.releaseGate = resolve;
    });
  }

  release(): void {
    this.releaseGate?.();
    this.gate = undefined;
    this.releaseGate = undefined;
  }

  async health() {
    return {
      component: "llm:delayed",
      status: "OK" as const,
      message: "ok",
      checkedAt: new Date().toISOString()
    };
  }

  async listModels() {
    return ["delayed"];
  }

  async generateActionProposal(context: LlmContext): Promise<ActionProposal> {
    this.callCount += 1;
    const call = this.callCount;
    if (this.gate) await this.gate;
    await sleep(this.delayMs);
    return this.proposalFactory(context, call);
  }
}

class TrackingMedia implements MediaProvider {
  speaks: string[] = [];
  scenes: string[] = [];
  stopCount = 0;

  async health() {
    return {
      component: "media:track",
      status: "OK" as const,
      message: "ok",
      checkedAt: new Date().toISOString()
    };
  }

  async speak(text: string): Promise<void> {
    this.speaks.push(text);
  }

  async stopSpeech(): Promise<void> {
    this.stopCount += 1;
  }

  async setScene(scene: string): Promise<void> {
    this.scenes.push(scene);
  }
}

describe("session epoch / stale AI results", () => {
  const cleanups: Array<() => void> = [];
  afterEach(() => {
    while (cleanups.length) cleanups.pop()?.();
  });

  it("TEST1: stop mid-LLM → no approval, speak, or state change from stale result", async () => {
    const bus = new LiveEventBus();
    const llm = new DelayedLlm();
    llm.delayMs = 2000;
    const media = new TrackingMedia();
    const orch = new LiveOrchestrator({
      accountId: "acc_a",
      eventBus: bus,
      llm,
      media,
      getCurrentProduct: () => product
    });
    cleanups.push(() => orch.stop());

    orch.start();
    const sessionA1 = orch.sessionId;
    expect(sessionA1).toBeTruthy();
    const stateAfterStart = orch.state;

    bus.publish(commentEvent("acc_a", "gia bao nhieu?", sessionA1));
    await sleep(500);
    orch.stop();

    expect(orch.isRunning).toBe(false);
    expect(orch.state).toBe("IDLE");
    await sleep(2200);

    expect(orch.listApprovals()).toHaveLength(0);
    expect(media.speaks).toHaveLength(0);
    expect(orch.state).toBe("IDLE");
    expect(orch.state).not.toBe(stateAfterStart);
  });

  it("TEST2: stop A1 + start A2 → A1 LLM result does not enqueue on A2", async () => {
    const bus = new LiveEventBus();
    const llm = new DelayedLlm();
    llm.delayMs = 1500;
    const media = new TrackingMedia();
    const approvals: string[] = [];
    const orch = new LiveOrchestrator({
      accountId: "acc_a",
      eventBus: bus,
      llm,
      media,
      getCurrentProduct: () => product,
      onApprovalChanged: (item) => {
        if (item.status === "PENDING" || item.status === "APPROVED" || item.status === "EXECUTED") {
          approvals.push(item.proposal.eventId ?? item.id);
        }
      }
    });
    cleanups.push(() => orch.stop());

    orch.start();
    const sessionA1 = orch.sessionId!;
    bus.publish(commentEvent("acc_a", "size nao co?", sessionA1));
    await sleep(400);
    orch.stop();

    orch.start();
    const sessionA2 = orch.sessionId!;
    expect(sessionA2).not.toBe(sessionA1);

    await sleep(1800);

    expect(orch.listApprovals()).toHaveLength(0);
    expect(approvals).toHaveLength(0);
    expect(media.speaks).toHaveLength(0);
  });

  it("TEST3: stop A leaves B in-flight request healthy", async () => {
    const busA = new LiveEventBus();
    const busB = new LiveEventBus();
    const llmA = new DelayedLlm();
    const llmB = new DelayedLlm();
    llmA.delayMs = 1200;
    llmB.delayMs = 400;
    const mediaA = new TrackingMedia();
    const mediaB = new TrackingMedia();

    const orchA = new LiveOrchestrator({
      accountId: "acc_a",
      eventBus: busA,
      llm: llmA,
      media: mediaA,
      getCurrentProduct: () => product
    });
    const orchB = new LiveOrchestrator({
      accountId: "acc_b",
      eventBus: busB,
      llm: llmB,
      media: mediaB,
      getCurrentProduct: () => product
    });
    cleanups.push(() => {
      orchA.stop();
      orchB.stop();
    });

    orchA.start();
    orchB.start();
    busA.publish(commentEvent("acc_a", "gia bao nhieu?", orchA.sessionId));
    busB.publish(commentEvent("acc_b", "ship bao lau?", orchB.sessionId));

    await sleep(200);
    orchA.stop();
    await sleep(1500);

    expect(orchA.listApprovals()).toHaveLength(0);
    expect(orchB.listApprovals().length).toBeGreaterThanOrEqual(1);
    expect(orchB.isRunning).toBe(true);
  });

  it("TEST4: stop during anti-repetition second Gemini call → no approval", async () => {
    const bus = new LiveEventBus();
    const seeded =
      "Cam on ban da quan tam san pham nay nhe minh goi y size M cho ban";
    let calls = 0;
    const llm: LlmProvider = {
      health: async () => ({
        component: "llm:anti",
        status: "OK",
        message: "ok",
        checkedAt: new Date().toISOString()
      }),
      listModels: async () => ["anti"],
      generateActionProposal: async (context) => {
        calls += 1;
        if (calls === 1) return speakProposal(context.event.id, seeded);
        if (calls === 2) return speakProposal(context.event.id, seeded);
        await sleep(2000);
        return speakProposal(
          context.event.id,
          "Cau tra loi hoan toan khac ve chat lieu vai cotton"
        );
      }
    };

    const media = new TrackingMedia();
    const orch = new LiveOrchestrator({
      accountId: "acc_a",
      eventBus: bus,
      llm,
      media,
      getCurrentProduct: () => product
    });
    cleanups.push(() => orch.stop());
    orch.setMode("MANUAL_ASSIST");
    orch.start();

    bus.publish(commentEvent("acc_a", "gia bao nhieu?", orch.sessionId));
    await sleep(50);
    const first = orch.listApprovals()[0];
    expect(first).toBeTruthy();
    await orch.resolveApproval(first!.id, "approve");
    expect(media.speaks.length).toBe(1);

    const approvalsBefore = orch.listApprovals().length;
    bus.publish(commentEvent("acc_a", "size nao co?", orch.sessionId));
    await sleep(300);
    expect(calls).toBeGreaterThanOrEqual(2);
    orch.stop();
    await sleep(2200);

    expect(orch.listApprovals()).toHaveLength(approvalsBefore);
    expect(media.speaks).toHaveLength(1);
  });

  it("scheduler discards in-flight proposal when session unbound", async () => {
    const provider = new DelayedLlm();
    provider.delayMs = 800;
    const scheduler = new AiRequestScheduler({
      provider,
      maxConcurrent: 1,
      staleMs: 60_000
    });
    const accountId = "acc_inflight";
    scheduler.bindSession(accountId, "sess_1");

    const job = scheduler.generateActionProposal({
      event: commentEvent(accountId, "gia bao nhieu?", "sess_1"),
      currentState: "COMMENT_REPLY",
      recentSpeech: [],
      product
    });

    await sleep(100);
    scheduler.unbindSession(accountId);
    const result = await job;

    expect(result.kind).toBe("IGNORE");
    expect(result.riskTags).toContain("scheduler_stale");
    expect(result.riskTags).toContain("session_ended");
  });
});
