import type { LiveEventBus } from "../core/event-bus";
import type { ApprovalItem, LiveEvent } from "../../shared/live-types";
import { analyzeComment } from "../../shared/comment-priority";
import {
  priorityFromAnalysis,
  sortCommentFeed,
  type CommentAiStatus,
  type CommentFeedItem,
  type CommentFeedSnapshot
} from "../../shared/comment-feed";

const MAX_BUFFER = 400;
const MAX_SNAPSHOT = 200;

export type CommentFeedServiceOptions = {
  eventBus: LiveEventBus;
};

/**
 * Consumes Event Bus COMMENT events, applies CommentPriority in main,
 * and exposes a capped feed for the operator UI. Never calls Gemini.
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

  getSnapshot(): CommentFeedSnapshot {
    const sorted = sortCommentFeed([...this.items.values()]);
    const capped = sorted.length > MAX_SNAPSHOT;
    return {
      items: sorted.slice(0, MAX_SNAPSHOT),
      total: this.items.size,
      capped
    };
  }

  setOperatorPriority(eventId: string, value = true): CommentFeedItem | undefined {
    const item = this.items.get(eventId);
    if (!item) return undefined;
    item.operatorPriority = value;
    if (value) {
      item.skippedAt = undefined;
      if (item.aiStatus === "SKIPPED") item.aiStatus = "NONE";
    }
    this.items.set(eventId, item);
    return item;
  }

  markReplied(eventId: string): CommentFeedItem | undefined {
    const item = this.items.get(eventId);
    if (!item) return undefined;
    item.repliedAt = new Date().toISOString();
    item.skippedAt = undefined;
    item.aiStatus = "EXECUTED";
    this.items.set(eventId, item);
    return item;
  }

  markSkipped(eventId: string): CommentFeedItem | undefined {
    const item = this.items.get(eventId);
    if (!item) return undefined;
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

  private ingest(event: LiveEvent): void {
    if (event.type !== "COMMENT") return;
    if (this.items.has(event.id)) return;

    const analysis = analyzeComment(event);
    const row: CommentFeedItem = {
      id: event.id,
      eventId: event.id,
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
    this.trim();
  }

  private trim(): void {
    if (this.items.size <= MAX_BUFFER) return;
    const ordered = [...this.items.values()].sort((a, b) => a.sequence - b.sequence);
    const drop = ordered.length - MAX_BUFFER;
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
