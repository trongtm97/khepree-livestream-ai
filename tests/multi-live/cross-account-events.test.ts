import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { LiveEventBus } from "../../src/main/core/event-bus";
import { CommentFeedService } from "../../src/main/live/comment-feed-service";
import type { LiveEvent } from "../../src/shared/live-types";
import { createTempDb, createTestManager, sampleProduct, sleep } from "../helpers/harness";

describe("multi-live / cross-account events", () => {
  const cleanups: Array<() => void> = [];
  afterEach(() => {
    while (cleanups.length) cleanups.pop()?.();
  });

  it("routes 100 events per account with zero cross-contamination", async () => {
    const h = createTempDb("khepree-xacc-");
    cleanups.push(() => h.dispose());

    h.products.save(sampleProduct("px", "X"));
    h.products.save(sampleProduct("py", "Y"));
    h.products.save(sampleProduct("pz", "Z"));

    const a = h.accounts.create({ username: "shop_a", label: "A" });
    const b = h.accounts.create({ username: "shop_b", label: "B" });
    const c = h.accounts.create({ username: "shop_c", label: "C" });

    const bus = new LiveEventBus();
    const feed = new CommentFeedService({ eventBus: bus });
    feed.start();
    cleanups.push(() => feed.stop());

    const manager = createTestManager(h);
    cleanups.push(() => manager.dispose());

    // Forward each runtime bus into the shared feed bus (same pattern as AppContainer).
    for (const id of [a.id, b.id, c.id]) {
      manager.setCurrentProduct(id, id === a.id ? "px" : id === b.id ? "py" : "pz");
      const rt = manager.ensureRuntime(id);
      const unsub = rt.eventBus.subscribe((ev) => bus.publish(ev));
      cleanups.push(unsub);
      manager.startLive(id);
    }

    const stamp = (accountId: string, i: number): LiveEvent => ({
      id: randomUUID(),
      sequence: i,
      type: "COMMENT",
      source: "operator",
      timestamp: new Date().toISOString(),
      accountId,
      username: `u_${accountId}_${i}`,
      text: `msg-${accountId}-${i}`
    });

    for (let i = 0; i < 100; i += 1) {
      manager.getRuntime(a.id)!.publishEvent(stamp(a.id, i));
      manager.getRuntime(b.id)!.publishEvent(stamp(b.id, i));
      manager.getRuntime(c.id)!.publishEvent(stamp(c.id, i));
    }

    await sleep(120);

    const fa = feed.getSnapshotForAccount(a.id);
    const fb = feed.getSnapshotForAccount(b.id);
    const fc = feed.getSnapshotForAccount(c.id);

    expect(fa.total).toBe(100);
    expect(fb.total).toBe(100);
    expect(fc.total).toBe(100);

    expect(fa.items.every((row) => row.accountId === a.id)).toBe(true);
    expect(fb.items.every((row) => row.accountId === b.id)).toBe(true);
    expect(fc.items.every((row) => row.accountId === c.id)).toBe(true);

    expect(fa.items.some((row) => row.accountId === b.id || row.accountId === c.id)).toBe(false);
    expect(fb.items.some((row) => row.accountId === a.id || row.accountId === c.id)).toBe(false);
    expect(fc.items.some((row) => row.accountId === a.id || row.accountId === b.id)).toBe(false);

    // Foreign event must be rejected by runtime
    expect(() =>
      manager.getRuntime(a.id)!.publishEvent(stamp(b.id, 999))
    ).toThrow(/EVENT_ACCOUNT_MISMATCH/);
  });
});
