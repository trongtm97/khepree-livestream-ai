import type { LiveEvent, ProductDNA } from "../live-types";
import type { LlmContextLike } from "./types";

export const FIXTURE_PRODUCT_GROUNDED: ProductDNA = {
  id: "prod-tee",
  title: "Áo thun cotton",
  priceText: "299000",
  currency: "VND",
  facts: ["100% cotton"],
  benefits: ["Thoáng mát"],
  materials: "100% cotton",
  sizes: ["S", "M", "L"],
  colors: ["Đen", "Trắng"],
  variants: [],
  stockText: "Còn hàng size M",
  shippingText: "Giao 1-3 ngày nội thành",
  warrantyText: "Đổi trả 7 ngày",
  faq: [],
  allowedClaims: ["cotton"],
  forbiddenClaims: ["chữa bệnh"],
  updatedAt: "2026-01-01T00:00:00.000Z"
};

export const FIXTURE_PRODUCT_THIN: ProductDNA = {
  id: "prod-thin",
  title: "Áo thun",
  facts: [],
  benefits: [],
  sizes: [],
  colors: [],
  variants: [],
  faq: [],
  allowedClaims: [],
  forbiddenClaims: [],
  updatedAt: "2026-01-01T00:00:00.000Z"
};

export const FIXTURE_EVENT: LiveEvent = {
  id: "evt-1",
  sequence: 1,
  type: "COMMENT",
  source: "tiktoklive",
  timestamp: "2026-01-01T00:00:00.000Z",
  accountId: "acc_fixture",
  username: "buyer1",
  displayName: "Lan",
  text: "giá bao nhiêu?"
};

export function fixtureContext(product?: ProductDNA): LlmContextLike {
  return {
    event: FIXTURE_EVENT,
    currentState: "COMMENT_REPLY",
    product: product ?? FIXTURE_PRODUCT_GROUNDED,
    recentSpeech: ["Xin chào mọi người"],
    recentComments: [
      { username: "a", text: "hi", timestamp: FIXTURE_EVENT.timestamp },
      { username: "buyer1", text: "giá bao nhiêu?", timestamp: FIXTURE_EVENT.timestamp }
    ],
    policyContext: {
      notes: ["No invented prices"]
    },
    detectedIntent: "PRICE_QUESTION"
  };
}

/** Deterministic valid model JSON (grounded price). */
export const FIXTURE_VALID_JSON = JSON.stringify({
  kind: "SPEAK",
  speech: "Giá hiện tại của Áo thun cotton là 299000 VND ạ.",
  confidence: 0.92,
  reason: "Price grounded in Product DNA",
  riskTags: [],
  nextState: "PRICE",
  intent: "PRICE_QUESTION"
});

/** Invalid JSON (not parseable). */
export const FIXTURE_INVALID_JSON = "here is the plan: kind SPEAK speech hello";

/** Valid JSON shape but SPEAK without speech → schema fail. */
export const FIXTURE_SCHEMA_INVALID_JSON = JSON.stringify({
  kind: "SPEAK",
  confidence: 0.5,
  reason: "missing speech",
  riskTags: []
});

/** Hallucinated price when DNA has no price. */
export const FIXTURE_HALLUCINATION_JSON = JSON.stringify({
  kind: "SPEAK",
  speech: "Giá chỉ 150000đ thôi, còn hàng nhiều.",
  confidence: 0.8,
  reason: "Invented price",
  riskTags: [],
  nextState: "PRICE",
  intent: "PRICE_QUESTION"
});

/** Medical claim hallucination. */
export const FIXTURE_MEDICAL_JSON = JSON.stringify({
  kind: "SPEAK",
  speech: "Áo này chữa khỏi cảm lạnh 100% hiệu quả.",
  confidence: 0.7,
  reason: "Bad claim",
  riskTags: [],
  nextState: "FEATURE"
});
