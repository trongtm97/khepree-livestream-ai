import { describe, expect, it } from "vitest";
import type { LiveEvent } from "../../src/shared/live-types";
import {
  LiveEventDeduplicator,
  DEFAULT_DEDUPE_TTL_MS,
  fingerprintLiveEvent
} from "../../src/main/live/live-event-deduplicator";
import { createTempDb, createTestManager, sampleProduct, sleep } from "../helpers/harness";

function event(partial: Partial<LiveEvent> & Pick<LiveEvent, "id" | "source" | "accountId">): LiveEvent {
  return {
    sequence: 1,
    type: "COMMENT",
    timestamp: new Date().toISOString(),
    text: "gia bao nhieu",
    username: "john",
    ...partial
  };
}

describe("cross-source event deduplication", () => {
  it("drops LIVE Manager duplicate of TikTokLive comment within window; keeps @mary; allows retry after TTL", () => {
    let now = 1_000_000;
    const dedupe = new LiveEventDeduplicator({
      now: () => now,
      ttlMs: 60_000,
      bucketMs: 3_000
    });

    const tiktok = event({
      id: "abc123",
      source: "tiktoklive",
      accountId: "acc_a",
      sessionId: "sess_1",
      username: "@john",
      text: "  gia   bao nhieu  "
    });
    expect(dedupe.accept(tiktok)).toBe(true);

    now += 600;
    const liveManager = event({
      id: "dom-8871",
      source: "live-manager",
      accountId: "acc_a",
      sessionId: "sess_1",
      username: "john",
      text: "gia bao nhieu"
    });
    expect(dedupe.accept(liveManager)).toBe(false);

    const metrics = dedupe.getMetrics();
    expect(metrics.duplicateDropped).toBe(1);
    expect(metrics.bySourcePair["tiktoklive→live-manager"]).toBe(1);

    const mary = event({
      id: "mary-1",
      source: "tiktoklive",
      accountId: "acc_a",
      sessionId: "sess_1",
      username: "mary",
      text: "gia bao nhieu"
    });
    expect(dedupe.accept(mary)).toBe(true);

    // Same @john after 2 minutes → accept again
    now += 120_000;
    const johnAgain = event({
      id: "abc456",
      source: "tiktoklive",
      accountId: "acc_a",
      sessionId: "sess_1",
      username: "john",
      text: "gia bao nhieu"
    });
    expect(dedupe.accept(johnAgain)).toBe(true);
  });

  it("never cross-dedupes different accounts", () => {
    const dedupe = new LiveEventDeduplicator();
    expect(
      dedupe.accept(
        event({
          id: "a1",
          source: "tiktoklive",
          accountId: "acc_a",
          username: "john",
          text: "gia bao nhieu"
        })
      )
    ).toBe(true);
    expect(
      dedupe.accept(
        event({
          id: "b1",
          source: "live-manager",
          accountId: "acc_b",
          username: "john",
          text: "gia bao nhieu"
        })
      )
    ).toBe(true);
  });

  it("exact event id is deduped", () => {
    const dedupe = new LiveEventDeduplicator();
    const e = event({
      id: "same-id",
      source: "tiktoklive",
      accountId: "acc_a",
      text: "hello"
    });
    expect(dedupe.accept(e)).toBe(true);
    expect(dedupe.accept({ ...e, source: "operator" })).toBe(false);
  });

  it("preserves SKU case in fingerprint text", () => {
    const a = fingerprintLiveEvent(
      event({
        id: "1",
        source: "tiktoklive",
        accountId: "acc",
        username: "u",
        text: "SKU-AbC"
      })
    );
    const b = fingerprintLiveEvent(
      event({
        id: "2",
        source: "live-manager",
        accountId: "acc",
        username: "u",
        text: "sku-abc"
      })
    );
    expect(a).not.toBe(b);
  });

  it("LiveRuntime publishEvent drops duplicate before bus + repo", async () => {
    const h = createTempDb("khepree-dedupe-");
    try {
      h.products.save(sampleProduct("p1", "P"));
      const acc = h.accounts.create({ username: "shop", label: "S" });
      const manager = createTestManager(h);
      manager.setCurrentProduct(acc.id, "p1");
      manager.startLive(acc.id);
      const rt = manager.ensureRuntime(acc.id);

      const seen: string[] = [];
      rt.eventBus.subscribe((e) => {
        seen.push(e.id);
      });

      rt.publishEvent(
        event({
          id: "abc123",
          source: "tiktoklive",
          accountId: acc.id,
          username: "john",
          text: "gia bao nhieu"
        })
      );
      await sleep(10);
      rt.publishEvent(
        event({
          id: "dom-8871",
          source: "live-manager",
          accountId: acc.id,
          username: "@john",
          text: "gia bao nhieu"
        })
      );
      await sleep(10);

      expect(seen).toEqual(["abc123"]);
      manager.dispose();
    } finally {
      h.dispose();
    }
  });

  it("TTL default is within 30–90s", () => {
    expect(DEFAULT_DEDUPE_TTL_MS).toBeGreaterThanOrEqual(30_000);
    expect(DEFAULT_DEDUPE_TTL_MS).toBeLessThanOrEqual(90_000);
  });
});
