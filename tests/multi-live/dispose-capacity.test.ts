import { afterEach, describe, expect, it } from "vitest";
import { AiRequestScheduler } from "../../src/main/live/ai-request-scheduler";
import { MockLlmProvider } from "../../src/main/connectors/llm/mock-llm-provider";
import { createTempDb, createTestManager, sampleProduct } from "../helpers/harness";
import { assertLiveCapacity } from "../../src/main/live/live-capacity-self-check";

describe("multi-live / dispose + capacity", () => {
  const cleanups: Array<() => void> = [];
  afterEach(() => {
    while (cleanups.length) cleanups.pop()?.();
  });

  it("dispose clears runtimes and allows no further start", () => {
    const h = createTempDb("khepree-disp-");
    cleanups.push(() => h.dispose());
    h.products.save(sampleProduct("p1", "P"));
    const a = h.accounts.create({ username: "shop_a", label: "A" });

    const manager = createTestManager(h);
    manager.setCurrentProduct(a.id, "p1");
    manager.startLive(a.id);
    expect(manager.countRunning()).toBe(1);

    manager.dispose();
    expect(manager.countRunning()).toBe(0);
    expect(manager.listRuntimes()).toHaveLength(0);
    expect(() => manager.startLive(a.id)).toThrow(/MULTI_LIVE_MANAGER_DISPOSED/);
  });

  it("AI scheduler cancelAll is safe when idle", () => {
    const provider = new MockLlmProvider();
    const scheduler = new AiRequestScheduler({ provider });
    scheduler.bindSession("acc_a", "sess_a");
    scheduler.unbindSession("acc_a");
    scheduler.cancelAll();
    expect(scheduler.getMetrics().queueLength).toBe(0);
  });

  it("license vs hardware capacity gates (self-check)", () => {
    expect(() => assertLiveCapacity()).not.toThrow();
  });
});
