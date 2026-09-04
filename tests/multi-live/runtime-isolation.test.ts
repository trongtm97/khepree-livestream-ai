import { afterEach, describe, expect, it } from "vitest";
import { assertLiveRuntimeIsolation } from "../../src/main/live/live-runtime-self-check";
import { createTempDb, createTestManager, sampleProduct } from "../helpers/harness";

describe("multi-live / runtime isolation", () => {
  const cleanups: Array<() => void> = [];
  afterEach(() => {
    while (cleanups.length) cleanups.pop()?.();
  });

  it("keeps three LiveRuntime instances isolated (legacy self-check)", async () => {
    await expect(assertLiveRuntimeIsolation()).resolves.toBeUndefined();
  });

  it("keeps product selection per account when A switches product", () => {
    const h = createTempDb("khepree-prod-");
    cleanups.push(() => h.dispose());
    h.products.save(sampleProduct("px", "X"));
    h.products.save(sampleProduct("py", "Y"));
    h.products.save(sampleProduct("pz", "Z"));

    const a = h.accounts.create({ username: "shop_a", label: "A" });
    const b = h.accounts.create({ username: "shop_b", label: "B" });

    const manager = createTestManager(h);
    cleanups.push(() => manager.dispose());

    manager.setCurrentProduct(a.id, "px");
    manager.setCurrentProduct(b.id, "py");
    manager.startLive(a.id);
    manager.startLive(b.id);

    expect(manager.getSnapshot(a.id).currentProductId).toBe("px");
    expect(manager.getSnapshot(b.id).currentProductId).toBe("py");

    manager.setCurrentProduct(a.id, "pz");
    expect(manager.getSnapshot(a.id).currentProductId).toBe("pz");
    expect(manager.getSnapshot(b.id).currentProductId).toBe("py");
  });
});
