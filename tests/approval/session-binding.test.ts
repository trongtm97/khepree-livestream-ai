import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import type { ActionProposal, LiveEvent, ProductDNA } from "../../src/shared/live-types";
import type { LlmContext, LlmProvider } from "../../src/main/connectors/llm/types";
import type { MediaProvider } from "../../src/main/connectors/media/types";
import { LiveEventBus } from "../../src/main/core/event-bus";
import { ApprovalEngine } from "../../src/main/live/approval-engine";
import { LiveOrchestrator } from "../../src/main/live/live-orchestrator";
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

function speakProposal(eventId: string = randomUUID()): ActionProposal {
  return {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    eventId,
    kind: "SPEAK",
    speech: "Cam on ban da quan tam san pham",
    confidence: 0.99,
    reason: "test",
    riskTags: [],
    nextState: "COMMENT_REPLY"
  };
}

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

class InstantLlm implements LlmProvider {
  async health() {
    return {
      component: "llm:instant",
      status: "OK" as const,
      message: "ok",
      checkedAt: new Date().toISOString()
    };
  }
  async listModels() {
    return ["instant"];
  }
  async generateActionProposal(context: LlmContext): Promise<ActionProposal> {
    return speakProposal(context.event.id);
  }
}

class TrackingMedia implements MediaProvider {
  speaks: string[] = [];
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
  async stopSpeech(): Promise<void> {}
  async setScene(): Promise<void> {}
}

describe("approval session binding", () => {
  const cleanups: Array<() => void> = [];
  afterEach(() => {
    while (cleanups.length) cleanups.pop()?.();
  });

  it("Case A: stop expires pending; new session starts with 0 pending", async () => {
    const bus = new LiveEventBus();
    const media = new TrackingMedia();
    const expired: string[] = [];
    const orch = new LiveOrchestrator({
      accountId: "acc_a",
      eventBus: bus,
      llm: new InstantLlm(),
      media,
      getCurrentProduct: () => product,
      approvalOptions: { supervisedDelayMs: 60_000 },
      onApprovalChanged: (item) => {
        if (item.status === "EXPIRED") expired.push(item.id);
      }
    });
    cleanups.push(() => orch.stop());

    orch.start();
    const sessionA1 = orch.sessionId!;
    for (const text of ["gia bao nhieu?", "size nao co?", "ship bao lau?"]) {
      bus.publish(commentEvent("acc_a", text, sessionA1));
    }
    await sleep(80);
    expect(orch.listApprovals()).toHaveLength(3);
    expect(orch.listApprovals().every((a) => a.sessionId === sessionA1)).toBe(true);
    expect(orch.listApprovals().every((a) => a.accountId === "acc_a")).toBe(true);

    orch.stop();
    expect(expired).toHaveLength(3);
    expect(orch.listApprovals()).toHaveLength(0);

    orch.start();
    expect(orch.sessionId).not.toBe(sessionA1);
    expect(orch.listApprovals()).toHaveLength(0);
  });

  it("Case B: overdue autoApproveAt from A1 must not speak after A2 starts", async () => {
    const bus = new LiveEventBus();
    const media = new TrackingMedia();
    const orch = new LiveOrchestrator({
      accountId: "acc_a",
      eventBus: bus,
      llm: new InstantLlm(),
      media,
      getCurrentProduct: () => product,
      approvalOptions: { supervisedDelayMs: 200 }
    });
    cleanups.push(() => orch.stop());

    orch.start();
    bus.publish(commentEvent("acc_a", "gia bao nhieu?", orch.sessionId));
    await sleep(50);
    expect(orch.listApprovals()).toHaveLength(1);
    expect(orch.listApprovals()[0]?.autoApproveAt).toBeTruthy();

    orch.stop();
    orch.start();
    await sleep(500);

    expect(orch.listApprovals()).toHaveLength(0);
    expect(media.speaks).toHaveLength(0);
  });

  it("Case C: stop A does not expire B pending approvals", async () => {
    const busA = new LiveEventBus();
    const busB = new LiveEventBus();
    const orchA = new LiveOrchestrator({
      accountId: "acc_a",
      eventBus: busA,
      llm: new InstantLlm(),
      media: new TrackingMedia(),
      getCurrentProduct: () => product,
      approvalOptions: { supervisedDelayMs: 60_000 }
    });
    const orchB = new LiveOrchestrator({
      accountId: "acc_b",
      eventBus: busB,
      llm: new InstantLlm(),
      media: new TrackingMedia(),
      getCurrentProduct: () => product,
      approvalOptions: { supervisedDelayMs: 60_000 }
    });
    cleanups.push(() => {
      orchA.stop();
      orchB.stop();
    });

    orchA.start();
    orchB.start();
    busA.publish(commentEvent("acc_a", "gia bao nhieu?", orchA.sessionId));
    busB.publish(commentEvent("acc_b", "size nao co?", orchB.sessionId));
    await sleep(80);

    expect(orchA.listApprovals()).toHaveLength(1);
    expect(orchB.listApprovals()).toHaveLength(1);

    orchA.stop();
    expect(orchA.listApprovals()).toHaveLength(0);
    expect(orchB.listApprovals()).toHaveLength(1);
    expect(orchB.listApprovals()[0]?.status).toBe("PENDING");
  });

  it("engine: collectTimedApprovals only for active sessionId", () => {
    const engine = new ApprovalEngine({
      supervisedDelayMs: 10,
      confidenceThreshold: 0.9
    });
    const a1 = engine.enqueue(speakProposal(), "SUPERVISED_AUTO", {
      accountId: "acc_a",
      sessionId: "sess_a1"
    });
    a1.autoApproveAt = new Date(Date.now() - 1000).toISOString();

    const dueWrong = engine.collectTimedApprovals("sess_a2");
    expect(dueWrong).toHaveLength(0);
    expect(engine.listPending()).toHaveLength(1);

    const dueRight = engine.collectTimedApprovals("sess_a1");
    expect(dueRight).toHaveLength(1);
    expect(dueRight[0]?.status).toBe("APPROVED");
  });

  it("engine: resolve expired throws APPROVAL_SESSION_EXPIRED / NOT_PENDING", () => {
    const engine = new ApprovalEngine({
      supervisedDelayMs: 3500,
      confidenceThreshold: 0.9
    });
    const item = engine.enqueue(speakProposal(), "MANUAL_ASSIST", {
      accountId: "acc_a",
      sessionId: "sess_1"
    });
    engine.expireSession("sess_1");
    expect(() => engine.resolve(item.id, "approve")).toThrow(/APPROVAL_SESSION_EXPIRED|APPROVAL_NOT_PENDING/);
  });
});
