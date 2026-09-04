import { afterEach, describe, expect, it } from "vitest";
import { assertMultiLiveManager } from "../../src/main/live/multi-live-manager-self-check";
import { createTempDb, createTestManager, sampleProduct } from "../helpers/harness";

describe("multi-live / stop lifecycle", () => {
  const cleanups: Array<() => void> = [];
  afterEach(() => {
    while (cleanups.length) cleanups.pop()?.();
  });

  it("covers manager map isolation, stop-one, stop-all, concurrency (self-check)", () => {
    expect(() => assertMultiLiveManager()).not.toThrow();
  });

  it("stop B leaves A and C running; stopAll clears all", () => {
    const h = createTempDb("khepree-stop-");
    cleanups.push(() => h.dispose());
    h.products.save(sampleProduct("p1", "P"));

    const a = h.accounts.create({ username: "shop_a", label: "A" });
    const b = h.accounts.create({ username: "shop_b", label: "B" });
    const c = h.accounts.create({ username: "shop_c", label: "C" });

    const manager = createTestManager(h);
    cleanups.push(() => manager.dispose());

    for (const id of [a.id, b.id, c.id]) {
      manager.setCurrentProduct(id, "p1");
      manager.startLive(id);
    }

    manager.stopLive(b.id);
    expect(manager.getSnapshot(a.id).isRunning).toBe(true);
    expect(manager.getSnapshot(b.id).isRunning).toBe(false);
    expect(manager.getSnapshot(c.id).isRunning).toBe(true);

    manager.stopAll();
    expect(manager.countRunning()).toBe(0);
    expect(manager.getSnapshot(a.id).isRunning).toBe(false);
    expect(manager.getSnapshot(b.id).isRunning).toBe(false);
    expect(manager.getSnapshot(c.id).isRunning).toBe(false);
  });
});
