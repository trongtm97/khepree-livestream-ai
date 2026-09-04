import type { LiveEvent } from "../live-types";
import type { SalesCommentIntent } from "./schema";

/**
 * Lightweight intent tag for prompt grounding.
 * Compatible with CommentPriority purchase/product signals — does not replace them.
 */
export function detectSalesCommentIntent(event: LiveEvent): SalesCommentIntent {
  if (event.type !== "COMMENT") return "OTHER";
  const text = event.text ?? "";

  if (/^(hi|hello|xin chào|chào|hey)\b/i.test(text.trim())) return "GREETING";
  if (/\b(giá|price|bao nhiêu tiền)\b/i.test(text)) return "PRICE_QUESTION";
  if (/\b(size|kích thước|cỡ)\b/i.test(text)) return "SIZE_QUESTION";
  if (/\b(ship|shipping|giao hàng|vận chuyển)\b/i.test(text)) return "SHIPPING_QUESTION";
  if (/\b(mua|chốt|đặt|order|checkout|buy)\b/i.test(text)) return "PURCHASE_INTENT";
  if (/\b(đắt|expensive|không tin|scam|lừa|tệ)\b/i.test(text)) return "OBJECTION";
  return "OTHER";
}
