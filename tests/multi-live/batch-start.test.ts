import { afterEach, describe, expect, it } from "vitest";
import type { TikTokAccount } from "../../src/shared/live-types";
import { LIVE_BATCH_REASONS } from "../../src/shared/live-batch";
import { MultiLiveRuntimeManager } from "../../src/main/live/multi-live-runtime-manager";
import { MockLlmProvider } from "../../src/main/connectors/llm/mock-llm-provider";
import { MockMediaProvider } from "../../src/main/connectors/media/mock-media-provider";
import { createTestLiveCapacity } from "../../src/main/live/live-capacity-service";
import type { LiveRuntime } from "../../src/main/live/live-runtime";
import { createTempDb, sampleProduct } from "../helpers/harness";

describe("live batch start/stop", () => {
  const cleanups: Array<() => void> = [];
  afterEach(() => {
    while (cleanups.length) cleanups.pop()?.();
  });

  it("5 accounts: B fail does not abort C/D; already-running + no-product skipped", () => {
    const h = createTempDb("khepree-batch-");
    cleanups.push(() => h.dispose());
    h.products.save(sampleProduct("p1", "Ao"));

    const a = h.accounts.create({ username: "shop_a", label: "A" });
    const b = h.accounts.create({ username: "shop_b", label: "B" });
    const c = h.accounts.create({ username: "shop_c", label: "C" });
    const d = h.accounts.create({ username: "shop_d", label: "D" });
    const e = h.accounts.create({ username: "shop_e", label: "E" });

    for (const id of [a.id, b.id, c.id, d.id]) {
      h.accountLiveSettings.upsert({ accountId: id, currentProductId: "p1" });
    }
    // E: no product → skipped

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
      createMedia: (accountId) => new MockMediaProvider(accountId),
      assertProductAccess: () => undefined,
      capacity: createTestLiveCapacity({ maxConcurrentLives: 10 }),
      assertReadyToStart: (account: TikTokAccount, _runtime: LiveRuntime) => {
        if (account.id === b.id) throw new Error("SIMULATED_B_FAIL");
      }
    });
    cleanups.push(() => manager.dispose());

    // A already running
    manager.startLive(a.id);
    expect(manager.getSnapshot(a.id).isRunning).toBe(true);

    const result = manager.startReadyLives({
      isTikTokConnected: () => true
    });

    expect(result.attempted).toBe(5);
    expect(result.started.map((x) => x.accountId).sort()).toEqual(
      [c.id, d.id].sort()
    );
    expect(
      result.skipped.some(
        (s) => s.accountId === a.id && s.reasonCode === LIVE_BATCH_REASONS.ALREADY_RUNNING
      )
    ).toBe(true);
    expect(
      result.skipped.some(
        (s) => s.accountId === e.id && s.reasonCode === LIVE_BATCH_REASONS.NO_PRODUCT
      )
    ).toBe(true);
    expect(
      result.failed.some((f) => f.accountId === b.id && f.reasonCode === "SIMULATED_B_FAIL")
    ).toBe(true);

    expect(manager.getSnapshot(c.id).isRunning).toBe(true);
    expect(manager.getSnapshot(d.id).isRunning).toBe(true);
    expect(manager.getSnapshot(b.id).isRunning).toBe(false);
  });

  it("recalculates capacity after each successful start", () => {
    const h = createTempDb("khepree-batch-cap-");
    cleanups.push(() => h.dispose());
    h.products.save(sampleProduct("p1", "Ao"));

    const ids = ["a", "b", "c"].map((u) => {
      const acc = h.accounts.create({ username: `shop_${u}`, label: u });
      h.accountLiveSettings.upsert({ accountId: acc.id, currentProductId: "p1" });
      return acc.id;
    });

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
      createMedia: (accountId) => new MockMediaProvider(accountId),
      assertProductAccess: () => undefined,
      capacity: createTestLiveCapacity({ maxConcurrentLives: 2 })
    });
    cleanups.push(() => manager.dispose());

    const result = manager.startReadyLives({ isTikTokConnected: () => true });
    expect(result.started).toHaveLength(2);
    expect(
      result.skipped.filter((s) => s.reasonCode === LIVE_BATCH_REASONS.CAPACITY_LIMIT)
    ).toHaveLength(1);
    expect(manager.countRunning()).toBe(2);
    expect(ids.every((id) => result.started.some((s) => s.accountId === id) || result.skipped.some((s) => s.accountId === id))).toBe(true);
  });

  it("stopAll stops running lives and does not throw per-account", () => {
    const h = createTempDb("khepree-batch-stop-");
    cleanups.push(() => h.dispose());
    h.products.save(sampleProduct("p1", "Ao"));
    const a = h.accounts.create({ username: "shop_a", label: "A" });
    const b = h.accounts.create({ username: "shop_b", label: "B" });
    for (const id of [a.id, b.id]) {
      h.accountLiveSettings.upsert({ accountId: id, currentProductId: "p1" });
    }

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
      createMedia: (accountId) => new MockMediaProvider(accountId),
      assertProductAccess: () => undefined,
      capacity: createTestLiveCapacity({ maxConcurrentLives: 5 })
    });
    cleanups.push(() => manager.dispose());

    manager.startLive(a.id);
    manager.startLive(b.id);
    const result = manager.stopAll();
    expect(result.stopped).toHaveLength(2);
    expect(manager.countRunning()).toBe(0);
  });

  it("skips TikTok disconnected without aborting others", () => {
    const h = createTempDb("khepree-batch-tt-");
    cleanups.push(() => h.dispose());
    h.products.save(sampleProduct("p1", "Ao"));
    const a = h.accounts.create({ username: "shop_a", label: "A" });
    const b = h.accounts.create({ username: "shop_b", label: "B" });
    for (const id of [a.id, b.id]) {
      h.accountLiveSettings.upsert({ accountId: id, currentProductId: "p1" });
    }

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
      createMedia: (accountId) => new MockMediaProvider(accountId),
      assertProductAccess: () => undefined,
      capacity: createTestLiveCapacity({ maxConcurrentLives: 5 })
    });
    cleanups.push(() => manager.dispose());

    const result = manager.startReadyLives({
      isTikTokConnected: (id) => id === b.id
    });
    expect(result.started.map((s) => s.accountId)).toEqual([b.id]);
    expect(
      result.skipped.some(
        (s) => s.accountId === a.id && s.reasonCode === LIVE_BATCH_REASONS.TIKTOK_DISCONNECTED
      )
    ).toBe(true);
  });
});
