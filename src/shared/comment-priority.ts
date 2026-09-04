import type { LiveEvent } from "./live-types";

export type CommentIntent =
  | "PURCHASE"
  | "PRODUCT_QUESTION"
  | "GENERAL"
  | "SPAM";

/** Structured result of CommentPriority — single scorer for main + UI. */
export interface CommentPriority {
  score: number;
  intent: CommentIntent;
  isPurchaseIntent: boolean;
  isProductQuestion: boolean;
  isSpam: boolean;
  /** High-signal for operators (same threshold orchestrator uses for LLM). */
  isImportant: boolean;
}

const IMPORTANT_THRESHOLD = 45;

const purchasePatterns = [
  /\b(mua|chốt|đặt|order|checkout|buy|take it)\b/i,
  /\b(còn hàng|in stock|available)\b/i
];
const productQuestionPatterns = [
  /\b(size|kích thước|màu|color|giá|price|ship|shipping|bảo hành|warranty)\b/i,
  /\?/
];
const spamPatterns = [
  /(.)\1{8,}/,
  /\b(follow me|sub4sub|spam)\b/i
];

/**
 * Single CommentPriority implementation. Do not re-score in the renderer.
 */
export function analyzeComment(event: LiveEvent): CommentPriority {
  if (event.type !== "COMMENT") {
    return {
      score: 0,
      intent: "GENERAL",
      isPurchaseIntent: false,
      isProductQuestion: false,
      isSpam: false,
      isImportant: false
    };
  }

  const text = event.text ?? "";
  const isSpam = spamPatterns.some((p) => p.test(text));
  if (isSpam) {
    return {
      score: -100,
      intent: "SPAM",
      isPurchaseIntent: false,
      isProductQuestion: false,
      isSpam: true,
      isImportant: false
    };
  }

  const isPurchaseIntent = purchasePatterns.some((p) => p.test(text));
  const isProductQuestion = productQuestionPatterns.some((p) => p.test(text));

  let score = 20;
  if (isPurchaseIntent) score += 80;
  if (isProductQuestion) score += 55;
  if (text.length > 8) score += 5;
  if (text.length > 160) score -= 10;
  score = Math.max(-100, Math.min(100, score));

  const intent: CommentIntent = isPurchaseIntent
    ? "PURCHASE"
    : isProductQuestion
      ? "PRODUCT_QUESTION"
      : "GENERAL";

  return {
    score,
    intent,
    isPurchaseIntent,
    isProductQuestion,
    isSpam: false,
    isImportant: score >= IMPORTANT_THRESHOLD
  };
}

/** Numeric score used by LiveOrchestrator threshold checks. */
export function scoreComment(event: LiveEvent): number {
  return analyzeComment(event).score;
}

export const COMMENT_IMPORTANT_THRESHOLD = IMPORTANT_THRESHOLD;

// ponytail: self-check
export function assertCommentPriorityHelpers(): void {
  const event: LiveEvent = {
    id: "1",
    sequence: 1,
    type: "COMMENT",
    source: "tiktoklive",
    timestamp: new Date().toISOString(),
    text: "mua size M còn không?"
  };
  const buy = analyzeComment(event);
  if (!buy.isPurchaseIntent || !buy.isProductQuestion || buy.score < IMPORTANT_THRESHOLD) {
    throw new Error("comment-priority purchase/question score broken");
  }
  if (scoreComment(event) !== buy.score) throw new Error("scoreComment drift");
}
