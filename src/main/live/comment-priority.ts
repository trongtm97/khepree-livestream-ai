import type { LiveEvent } from "../../shared/live-types";

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

export function scoreComment(event: LiveEvent): number {
  if (event.type !== "COMMENT") return 0;
  const text = event.text ?? "";
  if (spamPatterns.some((p) => p.test(text))) return -100;

  let score = 20;
  if (purchasePatterns.some((p) => p.test(text))) score += 80;
  if (productQuestionPatterns.some((p) => p.test(text))) score += 55;
  if (text.length > 8) score += 5;
  if (text.length > 160) score -= 10;
  return Math.max(-100, Math.min(100, score));
}
