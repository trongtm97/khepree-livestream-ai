import type { CommentIntent, CommentPriority } from "./comment-priority";

export type CommentAiStatus =
  | "NONE"
  | "QUEUED"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "EXECUTED"
  | "REJECTED"
  | "SKIPPED";

export type CommentFeedFilter =
  | "all"
  | "important"
  | "purchase"
  | "product_question"
  | "replied"
  | "skipped";

/** Operator-facing comment row — priority comes from main CommentPriority only. */
export interface CommentFeedItem {
  id: string;
  eventId: string;
  sequence: number;
  username?: string;
  displayName?: string;
  /** Present only when the source event included one — never invented. */
  avatarUrl?: string;
  text: string;
  timestamp: string;
  priority: number;
  intent: CommentIntent;
  isImportant: boolean;
  isPurchaseIntent: boolean;
  isProductQuestion: boolean;
  aiStatus: CommentAiStatus;
  /** Operator "Ưu tiên trả lời". */
  operatorPriority: boolean;
  repliedAt?: string;
  skippedAt?: string;
}

export interface CommentFeedSnapshot {
  items: CommentFeedItem[];
  total: number;
  capped: boolean;
}

export function matchesCommentFilter(
  item: CommentFeedItem,
  filter: CommentFeedFilter
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "important":
      return item.isImportant || item.operatorPriority;
    case "purchase":
      return item.isPurchaseIntent;
    case "product_question":
      return item.isProductQuestion;
    case "replied":
      return item.aiStatus === "EXECUTED" || Boolean(item.repliedAt);
    case "skipped":
      return item.aiStatus === "SKIPPED" || Boolean(item.skippedAt);
    default:
      return true;
  }
}

/** Sort: operator pin first, then priority desc, then newest. */
export function sortCommentFeed(items: CommentFeedItem[]): CommentFeedItem[] {
  return [...items].sort((a, b) => {
    if (a.operatorPriority !== b.operatorPriority) {
      return a.operatorPriority ? -1 : 1;
    }
    if (a.priority !== b.priority) return b.priority - a.priority;
    return b.sequence - a.sequence;
  });
}

export function priorityFromAnalysis(p: CommentPriority): Pick<
  CommentFeedItem,
  | "priority"
  | "intent"
  | "isImportant"
  | "isPurchaseIntent"
  | "isProductQuestion"
> {
  return {
    priority: p.score,
    intent: p.intent,
    isImportant: p.isImportant,
    isPurchaseIntent: p.isPurchaseIntent,
    isProductQuestion: p.isProductQuestion
  };
}
