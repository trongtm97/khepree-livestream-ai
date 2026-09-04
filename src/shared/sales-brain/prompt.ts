import type { ProductDNA } from "../live-types";
import type { LlmContextLike } from "./types";
import { detectSalesCommentIntent } from "./intent";

const SYSTEM_RULES = [
  "You are the sales brain inside Khepree Livestream AI.",
  "Return ONE JSON object only. No markdown. No prose outside JSON.",
  "Product DNA is the ONLY source of truth for product facts.",
  "NEVER invent price, stock, sizes, colors, shipping, warranty, materials, or regulated claims.",
  "NEVER invent medical or legal claims (cure, 100% effective, guaranteed, FDA, etc.).",
  "If a required fact is missing from Product DNA, set kind to ASK_OPERATOR.",
  "Prefer short Vietnamese livestream speech when kind is SPEAK or THANK_USER.",
  "Do NOT repeat recent speech or recent CTAs — vary wording while staying grounded.",
  "Schema keys: kind, speech?, scene?, productRef?, confidence, reason, riskTags, nextState?, intent?",
  "kind enum: SPEAK|SET_SCENE|PIN_PRODUCT|THANK_USER|ASK_OPERATOR|IGNORE",
  "confidence is 0..1. riskTags is a string array (may be empty).",
  "intent optional enum: GREETING|PRICE_QUESTION|SIZE_QUESTION|SHIPPING_QUESTION|PURCHASE_INTENT|OBJECTION|OTHER"
].join("\n");

export function buildSalesBrainPrompt(
  context: LlmContextLike,
  opts?: { retryHint?: string }
): string {
  const intent = context.detectedIntent ?? detectSalesCommentIntent(context.event);
  const product = context.product;
  const policy = buildPolicyContext(context, product);

  const parts = [
    SYSTEM_RULES,
    `CURRENT_SALES_STATE=${context.currentState}`,
    `LAST_SCENE=${context.lastScene ?? ""}`,
    `DETECTED_INTENT=${intent}`,
    `LIVE_EVENT=${JSON.stringify(sanitizeEvent(context.event))}`,
    `PRODUCT_DNA=${JSON.stringify(product ? sanitizeProduct(product) : null)}`,
    `RECENT_SPEECH=${JSON.stringify(context.recentSpeech)}`,
    `RECENT_CTA=${JSON.stringify(context.recentCta ?? [])}`,
    `RECENT_RESPONDED_COMMENTS=${JSON.stringify(context.recentRespondedComments ?? [])}`,
    `RECENT_CUSTOMER_QUESTIONS=${JSON.stringify(context.recentCustomerQuestions ?? [])}`,
    `RECENT_COMMENTS=${JSON.stringify(context.recentComments ?? [])}`,
    `POLICY_CONTEXT=${JSON.stringify(policy)}`
  ];

  if (context.antiRepetitionHint) {
    parts.push(`ANTI_REPETITION=${context.antiRepetitionHint}`);
  }

  if (opts?.retryHint) {
    parts.push(
      `RETRY_HINT=Previous output was invalid or unsafe (${opts.retryHint}). Return valid JSON only. Do not invent facts.`
    );
  }

  return parts.join("\n");
}

function sanitizeEvent(event: LlmContextLike["event"]) {
  return {
    id: event.id,
    type: event.type,
    username: event.username,
    displayName: event.displayName,
    text: event.text,
    amount: event.amount,
    timestamp: event.timestamp
  };
}

function sanitizeProduct(product: ProductDNA) {
  return {
    id: product.id,
    title: product.title,
    description: product.description,
    priceText: product.priceText,
    currency: product.currency,
    facts: product.facts,
    benefits: product.benefits,
    materials: product.materials,
    sizes: product.sizes,
    colors: product.colors,
    variants: product.variants,
    stockText: product.stockText,
    shippingText: product.shippingText,
    warrantyText: product.warrantyText,
    faq: product.faq,
    allowedClaims: product.allowedClaims,
    forbiddenClaims: product.forbiddenClaims,
    aiNotes: product.aiNotes
  };
}

function buildPolicyContext(context: LlmContextLike, product?: ProductDNA) {
  return {
    forbiddenClaims: [
      ...(context.policyContext?.forbiddenClaims ?? []),
      ...(product?.forbiddenClaims ?? [])
    ],
    allowedClaims: [
      ...(context.policyContext?.allowedClaims ?? []),
      ...(product?.allowedClaims ?? [])
    ],
    notes: [
      ...(context.policyContext?.notes ?? []),
      ...(product?.aiNotes ? [product.aiNotes] : [])
    ],
    missingFactsHint:
      "If price/stock/size/shipping/warranty/materials are absent in PRODUCT_DNA, ASK_OPERATOR."
  };
}
