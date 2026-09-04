/**
 * Multi-live CommentFeed isolation (PROMPT 03).
 *
 * Run: npx --yes tsx src/main/live/comment-feed-self-check.ts
 */
import { randomUUID } from "node:crypto";
import { LiveEventBus } from "../core/event-bus";
import type { ApprovalItem, LiveEvent } from "../../shared/live-types";
import { UNASSIGNED_ACCOUNT_ID } from "../../shared/live-types";
import {
  CommentFeedService,
  MAX_PER_ACCOUNT
} from "./comment-feed-service";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function comment(
  accountId: string,
  text: string,
  sequence: number,
  sessionId?: string
): LiveEvent {
  return {
    id: randomUUID(),
    sequence,
    type: "COMMENT",
    source: "tiktoklive",
    timestamp: new Date().toISOString(),
    accountId,
    sessionId,
    username: "buyer",
    text
  };
}

export function assertCommentFeedMultiLive(): void {
  const bus = new LiveEventBus();
  const feed = new CommentFeedService({ eventBus: bus });
  feed.start();

  const a = "acc_shop_a";
  const b = "acc_shop_b";
  const c = "acc_shop_c";

  // A floods buffer; B/C stay intact
  for (let i = 1; i <= 300; i += 1) {
    feed.ingestForTest(comment(a, `A-${i}`, i, "sess_a"));
  }
  for (let i = 1; i <= 20; i += 1) {
    feed.ingestForTest(comment(b, `B-${i}`, i, "sess_b"));
    feed.ingestForTest(comment(c, `C-${i}`, i, "sess_c"));
  }

  assert(feed.countForAccount(a) === MAX_PER_ACCOUNT, `A capped at ${MAX_PER_ACCOUNT}`);
  assert(feed.countForAccount(b) === 20, `B kept 20, got ${feed.countForAccount(b)}`);
  assert(feed.countForAccount(c) === 20, `C kept 20, got ${feed.countForAccount(c)}`);

  const snapB = feed.getSnapshotForAccount(b);
  assert(snapB.total === 20, "B snapshot total");
  assert(snapB.items.length === 20, "B snapshot items");
  assert(snapB.items.every((row) => row.accountId === b), "B rows own accountId");
  assert(snapB.items.every((row) => row.sessionId === "sess_b"), "B sessionId copied");

  const global = feed.getSnapshot();
  assert(global.items.every((row) => Boolean(row.accountId)), "global rows have accountId");
  assert(global.total === MAX_PER_ACCOUNT + 40, "total across accounts in buffer");
  assert(global.capped, "global snapshot capped separately from per-account buffer");

  // Missing / unassigned accountId rejected
  const before = feed.getSnapshot().total;
  feed.ingestForTest({
    ...comment("", "orphan", 999),
    accountId: ""
  });
  feed.ingestForTest({
    ...comment(UNASSIGNED_ACCOUNT_ID, "orphan2", 1000),
    accountId: UNASSIGNED_ACCOUNT_ID
  });
  assert(feed.getSnapshot().total === before, "missing accountId must not ingest");

  // Cross-account pin rejected
  const bItem = snapB.items[0]!;
  let mismatch = false;
  try {
    feed.setOperatorPriority(a, bItem.eventId, true);
  } catch (err) {
    mismatch = err instanceof Error && err.message === "COMMENT_ACCOUNT_MISMATCH";
  }
  assert(mismatch, "pin with wrong account must throw COMMENT_ACCOUNT_MISMATCH");

  feed.setOperatorPriority(b, bItem.eventId, true);
  assert(
    feed.getSnapshotForAccount(b).items.find((r) => r.eventId === bItem.eventId)?.operatorPriority,
    "pin on owning account works"
  );
  assert(
    feed.getSnapshot().items.some((r) => r.eventId === bItem.eventId && r.accountId === b),
    "pinned B surfaces in global snapshot despite A flood"
  );

  // Cross-account approval must not update
  const approvalWrong: ApprovalItem = {
    id: randomUUID(),
    accountId: a,
    status: "EXECUTED",
    createdAt: new Date().toISOString(),
    resolvedAt: new Date().toISOString(),
    proposal: {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      kind: "SPEAK",
      speech: "hi",
      confidence: 0.9,
      reason: "test",
      riskTags: [],
      eventId: bItem.eventId
    }
  };
  feed.applyApproval(approvalWrong);
  assert(
    feed.getSnapshotForAccount(b).items.find((r) => r.eventId === bItem.eventId)?.aiStatus !==
      "EXECUTED",
    "wrong-account approval must not update"
  );

  const approvalOk: ApprovalItem = {
    ...approvalWrong,
    id: randomUUID(),
    accountId: b,
    proposal: {
      ...approvalWrong.proposal,
      id: randomUUID(),
      createdAt: new Date().toISOString()
    }
  };
  feed.applyApproval(approvalOk);
  assert(
    feed.getSnapshotForAccount(b).items.find((r) => r.eventId === bItem.eventId)?.aiStatus ===
      "EXECUTED",
    "matching approval updates feed"
  );

  // High-priority global includes pinned B
  const hi = feed.getHighPriorityGlobalSnapshot();
  assert(
    hi.items.some((r) => r.eventId === bItem.eventId && r.accountId === b),
    "high-priority snapshot keeps provenance"
  );

  feed.stop();
}

const entry = process.argv[1] ?? "";
if (/comment-feed-self-check\.(ts|js)$/.test(entry.replace(/\\/g, "/"))) {
  try {
    assertCommentFeedMultiLive();
    console.log("comment-feed self-check PASS");
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
