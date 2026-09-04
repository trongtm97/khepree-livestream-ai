import type { LiveEventBus } from "../core/event-bus";
import type { ApprovalItem, LiveEvent } from "../../shared/live-types";
import { UNASSIGNED_ACCOUNT_ID } from "../../shared/live-types";
import { analyzeComment } from "../../shared/comment-priority";
import {
  priorityFromAnalysis,
  sortCommentFeed,
  type CommentAiStatus,
  type CommentFeedItem,
  type CommentFeedSnapshot
} from "../../shared/comment-feed";

/** Soft cap per account so one busy shop cannot evict another's rows. */
export const MAX_PER_ACCOUNT = 300;
/** Global operator dashboard render/source cap. */
export const MAX_GLOBAL_SNAPSHOT = 200;
/** Per-account snapshot cap. */
export const MAX_ACCOUNT_SNAPSHOT = 200;

export type CommentFeedServiceOptions = {
  eventBus: LiveEventBus;
  /** Fired after a COMMENT is accepted into the feed (deduped by event.id). */
  onCommentIngested?: (accountId: string) => void;
};

/**
 * Consumes Event Bus COMMENT events, applies CommentPriority in main,
 * and exposes capped global + per-account feeds. Never calls Gemini.
 */
export class CommentFeedService {
  private readonly items = new Map<string, CommentFeedItem>();
  private unsubscribe?: () => void;

  constructor(private readonly opts: CommentFeedServiceOptions) {}

  start(): void {
    if (this.unsubscribe) return;
    this.unsubscribe = this.opts.eventBus.subscribe((event) => {
      this.ingest(event);
    });
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
  }

  /** Global fan-in snapshot for "needs attention" dashboard. */
  getSnapshot(): CommentFeedSnapshot {
    const sorted = sortCommentFeed([...this.items.values()]);
    const capped = sorted.length > MAX_GLOBAL_SNAPSHOT;
    return {
      items: sorted.slice(0, MAX_GLOBAL_SNAPSHOT),
      total: this.items.size,
      capped
    };
  }

  getSnapshotForAccount(accountId: string): CommentFeedSnapshot {
    const id = accountId.trim();
    if (!id) throw new Error("ACCOUNT_ID_REQUIRED");
    const rows = [...this.items.values()].filter((r) => r.accountId === id);
    const sorted = sortCommentFeed(rows);
    const capped = sorted.length > MAX_ACCOUNT_SNAPSHOT;
    return {
      accountId: id,
      items: sorted.slice(0, MAX_ACCOUNT_SNAPSHOT),
      total: rows.length,
      capped
    };
  }

  /** High-priority / operator-pinned rows across accounts. */
  getHighPriorityGlobalSnapshot(): CommentFeedSnapshot {
    const rows = [...this.items.values()].filter(
      (r) => r.operatorPriority || r.isImportant || r.isPurchaseIntent
    );
    const sorted = sortCommentFeed(rows);
    const capped = sorted.length > MAX_GLOBAL_SNAPSHOT;
    return {
      items: sorted.slice(0, MAX_GLOBAL_SNAPSHOT),
      total: rows.length,
      capped
    };
  }

  setOperatorPriority(
    accountId: string,
    eventId: string,
    value = true
  ): CommentFeedItem {
    const item = this.requireOwned(accountId, eventId);
    item.operatorPriority = value;
    if (value) {
      item.skippedAt = undefined;
      if (item.aiStatus === "SKIPPED") item.aiStatus = "NONE";
    }
    this.items.set(eventId, item);
    return item;
  }

  markReplied(accountId: string, eventId: string): CommentFeedItem {
    const item = this.requireOwned(accountId, eventId);
    item.repliedAt = new Date().toISOString();
    item.skippedAt = undefined;
    item.aiStatus = "EXECUTED";
    this.items.set(eventId, item);
    return item;
  }

  markSkipped(accountId: string, eventId: string): CommentFeedItem {
    const item = this.requireOwned(accountId, eventId);
    item.skippedAt = new Date().toISOString();
    item.operatorPriority = false;
    item.aiStatus = "SKIPPED";
    this.items.set(eventId, item);
    return item;
  }

  /** Sync AI status from Approval Engine (by proposal.eventId). */
  applyApproval(item: ApprovalItem): void {
    const eventId = item.proposal.eventId;
    if (!eventId) return;
    const row = this.items.get(eventId);
    if (!row) return;

    if (!item.accountId || row.accountId !== item.accountId) {
      console.error(
        "[CommentFeed] applyApproval account mismatch",
        eventId,
        "feed=",
        row.accountId,
        "approval=",
        item.accountId
      );
      return;
    }

    if (item.proposal.kind === "IGNORE" && item.status === "APPROVED") {
      row.aiStatus = "SKIPPED";
      row.skippedAt = item.resolvedAt ?? new Date().toISOString();
      this.items.set(eventId, row);
      return;
    }

    row.aiStatus = mapApprovalStatus(item.status);
    if (item.status === "EXECUTED") {
      row.repliedAt = item.resolvedAt ?? new Date().toISOString();
    }
    if (item.status === "REJECTED") {
      row.aiStatus = "REJECTED";
    }
    this.items.set(eventId, row);
  }

  /** Test/dev: count rows for one account without snapshot cap. */
  countForAccount(accountId: string): number {
    const id = accountId.trim();
    let n = 0;
    for (const row of this.items.values()) {
      if (row.accountId === id) n += 1;
    }
    return n;
  }

  /** Test seam — ingest without Event Bus. */
  ingestForTest(event: LiveEvent): void {
    this.ingest(event);
  }

  private requireOwned(accountId: string, eventId: string): CommentFeedItem {
    const aid = accountId.trim();
    const eid = eventId.trim();
    if (!aid) throw new Error("ACCOUNT_ID_REQUIRED");
    if (!eid) throw new Error("COMMENT_ID_REQUIRED");
    const item = this.items.get(eid);
    if (!item) throw new Error("COMMENT_NOT_FOUND");
    if (item.accountId !== aid) throw new Error("COMMENT_ACCOUNT_MISMATCH");
    return item;
  }

  private ingest(event: LiveEvent): void {
    if (event.type !== "COMMENT") return;
    if (this.items.has(event.id)) return;

    const accountId = event.accountId?.trim();
    if (!accountId || accountId === UNASSIGNED_ACCOUNT_ID) {
      console.error("[CommentFeed] COMMENT_ACCOUNT_ID_MISSING", event.id);
      return;
    }

    const analysis = analyzeComment(event);
    const row: CommentFeedItem = {
      id: event.id,
      eventId: event.id,
      accountId,
      sessionId: event.sessionId,
      sequence: event.sequence,
      username: event.username,
      displayName: event.displayName,
      avatarUrl: extractAvatarUrl(event),
      text: event.text ?? "",
      timestamp: event.timestamp,
      ...priorityFromAnalysis(analysis),
      aiStatus: "NONE",
      operatorPriority: false
    };

    this.items.set(event.id, row);
    this.trimAccount(accountId);
    this.opts.onCommentIngested?.(accountId);
  }

  private trimAccount(accountId: string): void {
    const rows = [...this.items.values()].filter((r) => r.accountId === accountId);
    if (rows.length <= MAX_PER_ACCOUNT) return;
    const ordered = rows.sort((a, b) => a.sequence - b.sequence);
    const drop = ordered.length - MAX_PER_ACCOUNT;
    for (let i = 0; i < drop; i += 1) {
      const id = ordered[i]?.eventId;
      if (id) this.items.delete(id);
    }
  }
}

function mapApprovalStatus(status: ApprovalItem["status"]): CommentAiStatus {
  switch (status) {
    case "PENDING":
      return "PENDING_APPROVAL";
    case "APPROVED":
      return "APPROVED";
    case "EXECUTED":
      return "EXECUTED";
    case "REJECTED":
      return "REJECTED";
    case "EXPIRED":
      return "NONE";
    case "FAILED":
      return "NONE";
    default:
      return "QUEUED";
  }
}

function extractAvatarUrl(event: LiveEvent): string | undefined {
  const raw = event.raw;
  if (!raw || typeof raw !== "object") return undefined;
  const rec = raw as Record<string, unknown>;
  for (const key of ["avatarUrl", "avatar_url", "profilePictureUrl"]) {
    const v = rec[key];
    if (typeof v === "string" && /^https?:\/\//i.test(v)) return v;
  }
  return undefined;
}
