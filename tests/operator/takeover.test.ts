/**
 * Human takeover: A muted, B continues; stale speech discarded on return.
 */
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import type { ActionProposal, LiveEvent, ProductDNA } from "../../src/shared/live-types";
import type { LlmContext, LlmProvider } from "../../src/main/connectors/llm/types";
import type { MediaProvider } from "../../src/main/connectors/media/types";
import { LiveEventBus } from "../../src/main/core/event-bus";
import { LiveOrchestrator } from "../../src/main/live/live-orchestrator";
import { OperatorControlService } from "../../src/main/live/operator-control-service";
import { createTempDb, sampleProduct, sleep } from "../helpers/harness";
import { MultiLiveRuntimeManager } from "../../src/main/live/multi-live-runtime-manager";
import { MockLlmProvider } from "../../src/main/connectors/llm/mock-llm-provider";
import { createTestLiveCapacity } from "../../src/main/live/live-capacity-service";
import { MockMediaProvider } from "../../src/main/connectors/media/mock-media-provider";

const product: ProductDNA = sampleProduct("p1", "Ao thun");

function speakProposal(speech: string, eventId: string): ActionProposal {
  return {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    eventId,
    kind: "SPEAK",
    speech,
    confidence: 0.99,
    reason: "test",
    riskTags: [],
    nextState: "COMMENT_REPLY"
  };
}

function commentEvent(accountId: string, text: string, at = Date.now()): LiveEvent {
  return {
    id: randomUUID(),
    sequence: 1,
    type: "COMMENT",
    source: "tiktoklive",
    timestamp: new Date(at).toISOString(),
    accountId,
    username: "buyer",
    displayName: "Buyer",
    text
  };
}

class InstantSpeakLlm implements LlmProvider {
  constructor(private readonly speech: string) {}
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
    return speakProposal(this.speech, context.event.id);
  }
}

class TrackingMedia implements MediaProvider {
  speaks: string[] = [];
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
  async setScene(): Promise<void> {}
}

describe("human takeover", () => {
  const cleanups: Array<() => void> = [];
  afterEach(() => {
    while (cleanups.length) cleanups.pop()?.();
  });

  it("A takeover stops pending A speech; B still auto-speaks", async () => {
    const busA = new LiveEventBus();
    const busB = new LiveEventBus();
    const mediaA = new TrackingMedia();
    const mediaB = new TrackingMedia();
    const orchA = new LiveOrchestrator({
      accountId: "acc_a",
      eventBus: busA,
      llm: new InstantSpeakLlm("Xin chào A"),
      media: mediaA,
      getCurrentProduct: () => product,
      approvalOptions: { supervisedDelayMs: 40, confidenceThreshold: 0.5 }
    });
    const orchB = new LiveOrchestrator({
      accountId: "acc_b",
      eventBus: busB,
      llm: new InstantSpeakLlm("Xin chào B"),
      media: mediaB,
      getCurrentProduct: () => product,
      approvalOptions: { supervisedDelayMs: 40, confidenceThreshold: 0.5 }
    });
    cleanups.push(() => orchA.stop(), () => orchB.stop());

    orchA.start();
    orchB.start();
    orchA.setMode("SUPERVISED_AUTO");
    orchB.setMode("SUPERVISED_AUTO");

    busA.publish(commentEvent("acc_a", "gia bao nhieu?"));
    busB.publish(commentEvent("acc_b", "size nao co?"));

    await sleep(80);
    expect(orchB.listApprovals().length + mediaB.speaks.length).toBeGreaterThan(0);
    orchA.enterTakeover();
    expect(mediaA.stopCount).toBeGreaterThanOrEqual(1);
    expect(orchA.listApprovals()).toHaveLength(0);

    // Approval timer ticks every 250ms.
    await sleep(350);

    expect(mediaA.speaks).not.toContain("Xin chào A");
    expect(mediaB.speaks).toContain("Xin chào B");
  });

  it("exit takeover discards stale events and speaks only new ones", async () => {
    const bus = new LiveEventBus();
    const media = new TrackingMedia();
    const orch = new LiveOrchestrator({
      accountId: "acc_a",
      eventBus: bus,
      llm: new InstantSpeakLlm("Loi moi"),
      media,
      getCurrentProduct: () => product,
      approvalOptions: { supervisedDelayMs: 40, confidenceThreshold: 0.5 }
    });
    cleanups.push(() => orch.stop());
    orch.start();
    orch.setMode("SUPERVISED_AUTO");

    const staleAt = Date.now() - 5_000;
    orch.enterTakeover();
    bus.publish(commentEvent("acc_a", "gia bao nhieu?", staleAt));
    await sleep(40);
    expect(orch.listApprovals()).toHaveLength(0);

    orch.exitTakeover();
    bus.publish(commentEvent("acc_a", "gia bao nhieu cu?", staleAt));
    await sleep(120);
    expect(media.speaks).toEqual([]);

    bus.publish(commentEvent("acc_a", "size nao co moi?", Date.now() + 2_000));
    await sleep(150);
    expect(media.speaks).toContain("Loi moi");
  });

  it("MultiLiveRuntimeManager: A takeover leaves B automation mode untouched", () => {
    const h = createTempDb("takeover-");
    cleanups.push(() => h.dispose());
    const a = h.accounts.create({ username: "shop_a", label: "SHOP US 01" });
    const b = h.accounts.create({ username: "shop_b", label: "SHOP US 02" });
    h.products.save(product);
    h.accountLiveSettings.upsert({ accountId: a.id, currentProductId: product.id });
    h.accountLiveSettings.upsert({ accountId: b.id, currentProductId: product.id });

    const control = new OperatorControlService();
    const manager = new MultiLiveRuntimeManager({
      accounts: h.accounts,
      accountLiveSettings: h.accountLiveSettings,
      repositories: {
        products: h.products,
        events: h.events,
        approvals: h.approvals,
        sessions: h.sessions,
        accountLiveSettings: h.accountLiveSettings
      },
      llm: new MockLlmProvider(),
      capacity: createTestLiveCapacity({ maxConcurrentLives: 5 }),
      assertProductAccess: () => undefined,
      createMedia: (id) => new MockMediaProvider(id),
      operatorControl: control
    });
    cleanups.push(() => manager.dispose());

    manager.startLive(a.id);
    manager.startLive(b.id);
    manager.setAutomationMode(a.id, "SUPERVISED_AUTO");
    manager.setAutomationMode(b.id, "SUPERVISED_AUTO");

    manager.enterTakeover(a.id);
    expect(manager.getSnapshot(a.id).operatorMode).toBe("HUMAN_TAKEOVER");
    expect(manager.getSnapshot(b.id).operatorMode).toBe("AI_ACTIVE");
    expect(manager.getSnapshot(b.id).automationMode).toBe("SUPERVISED_AUTO");
    expect(manager.getRuntime(a.id)?.isRunning).toBe(true);
  });
});
