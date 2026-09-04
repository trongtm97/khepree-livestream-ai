import { z } from "zod";

export const ACTION_KINDS = [
  "SPEAK",
  "SET_SCENE",
  "PIN_PRODUCT",
  "THANK_USER",
  "ASK_OPERATOR",
  "IGNORE"
] as const;

export const LIVE_STATES = [
  "IDLE",
  "WELCOME",
  "PRODUCT_INTRO",
  "FEATURE",
  "BENEFIT",
  "DEMO",
  "SOCIAL_PROOF",
  "PRICE",
  "OBJECTION",
  "COMMENT_REPLY",
  "ORDER_REACTION",
  "CTA",
  "PRODUCT_SWITCH",
  "PAUSED"
] as const;

/** Optional intent labels — additive, keeps ActionProposal compatible. */
export const SALES_COMMENT_INTENTS = [
  "GREETING",
  "PRICE_QUESTION",
  "SIZE_QUESTION",
  "SHIPPING_QUESTION",
  "PURCHASE_INTENT",
  "OBJECTION",
  "OTHER"
] as const;

export type SalesCommentIntent = (typeof SALES_COMMENT_INTENTS)[number];

/** Model JSON only — id/createdAt/eventId are added by TypeScript. */
export const ActionProposalModelSchema = z
  .object({
    kind: z.enum(ACTION_KINDS),
    speech: z.string().optional(),
    scene: z.string().optional(),
    productRef: z.string().optional(),
    confidence: z.number().min(0).max(1),
    reason: z.string().min(1),
    riskTags: z.array(z.string()).default([]),
    nextState: z.enum(LIVE_STATES).optional(),
    intent: z.enum(SALES_COMMENT_INTENTS).optional()
  })
  .superRefine((val, ctx) => {
    if (
      (val.kind === "SPEAK" || val.kind === "THANK_USER") &&
      !val.speech?.trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "SPEAK/THANK_USER requires non-empty speech",
        path: ["speech"]
      });
    }
  });

export type ActionProposalModel = z.infer<typeof ActionProposalModelSchema>;
