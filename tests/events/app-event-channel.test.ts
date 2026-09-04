import { describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { AppEventHub } from "../../src/main/core/app-event-hub";
import { LiveEventBus } from "../../src/main/core/event-bus";
import { CommentFeedService } from "../../src/main/live/comment-feed-service";
import { createSnapshotSyncController } from "../../src/renderer/app/snapshot-sync";
import type { LiveEvent } from "../../src/shared/live-types";
import { makeAppEvent } from "../../src/shared/app-events";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

describe("app event channel", () => {
  it("emits 100 COMMENT_RECEIVED to subscribers without requiring APP_SNAPSHOT", () => {
    const broadcasts: unknown[] = [];
    const hub = new AppEventHub({
      broadcast: (e) => broadcasts.push(e)
    });
    const received: string[] = [];
    hub.subscribe((e) => {
      if (e.type === "COMMENT_RECEIVED") received.push(e.accountId ?? "");
    });

    for (let i = 0; i < 100; i += 1) {
      hub.emit("COMMENT_RECEIVED", "acc_a");
    }

    expect(received).toHaveLength(100);
    expect(broadcasts).toHaveLength(100);
    expect(hub.emitted).toBe(100);
  });

  it("CommentFeed fires COMMENT_RECEIVED once per ingested comment", () => {
    const bus = new LiveEventBus();
    const seen: string[] = [];
    const feed = new CommentFeedService({
      eventBus: bus,
      onCommentIngested: (accountId) => seen.push(accountId)
    });
    feed.start();

    for (let i = 0; i < 100; i += 1) {
      const event: LiveEvent = {
        id: randomUUID(),
        sequence: i + 1,
        type: "COMMENT",
        source: "tiktoklive",
        timestamp: new Date().toISOString(),
        accountId: "acc_a",
        username: "buyer",
        text: `msg ${i}`
      };
      bus.publish(event);
    }

    expect(seen).toHaveLength(100);
    expect(feed.getSnapshot().items.length).toBeGreaterThan(0);
    feed.stop();
  });

  it("coalesces 100 COMMENT_RECEIVED into one comments refresh — not 100 full snapshots", async () => {
    const refreshFull = vi.fn(async () => undefined);
    const refreshComments = vi.fn(async () => undefined);
    const refreshHealth = vi.fn(async () => undefined);

    const sync = createSnapshotSyncController({
      refreshFull,
      refreshComments,
      refreshHealth,
      coalesceMs: 30,
      fallbackMs: 60_000,
      healthMs: 60_000
    });

    for (let i = 0; i < 100; i += 1) {
      sync.handleEvent(makeAppEvent("COMMENT_RECEIVED", "acc_a"));
    }

    await sleep(80);
    await sync.flushNow();

    expect(sync.getStats().eventsSeen).toBe(100);
    expect(refreshComments).toHaveBeenCalledTimes(1);
    expect(refreshFull).toHaveBeenCalledTimes(0);

    sync.stop();
  });

  it("non-comment events coalesce into a single full refresh", async () => {
    const refreshFull = vi.fn(async () => undefined);
    const refreshComments = vi.fn(async () => undefined);
    const refreshHealth = vi.fn(async () => undefined);

    const sync = createSnapshotSyncController({
      refreshFull,
      refreshComments,
      refreshHealth,
      coalesceMs: 20,
      fallbackMs: 60_000,
      healthMs: 60_000
    });

    sync.handleEvent(makeAppEvent("LIVE_UPDATED", "acc_a"));
    sync.handleEvent(makeAppEvent("APPROVAL_UPDATED", "acc_a"));
    sync.handleEvent(makeAppEvent("COMMENT_RECEIVED", "acc_a"));
    await sleep(50);
    await sync.flushNow();

    expect(refreshFull).toHaveBeenCalledTimes(1);
    expect(refreshComments).toHaveBeenCalledTimes(0);
    sync.stop();
  });
});
