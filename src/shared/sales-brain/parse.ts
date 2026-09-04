import type { ActionProposal } from "../live-types";
import { ActionProposalModelSchema, type ActionProposalModel } from "./schema";
import { applyHallucinationGuard } from "./grounding";
import type { LlmContextLike } from "./types";
import { detectSalesCommentIntent } from "./intent";

function newId(): string {
  return globalThis.crypto.randomUUID();
}

export type SalesBrainParseFailureCode = "INVALID_JSON" | "SCHEMA" | "HALLUCINATION";

export type SalesBrainParseResult =
  | { ok: true; proposal: ActionProposal; model: ActionProposalModel }
  | {
      ok: false;
      code: SalesBrainParseFailureCode;
      error: string;
      raw?: unknown;
    };

/** Extract a JSON object from model text (strips fences; finds first object). */
export function extractJsonObject(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("INVALID_JSON");
  }
}

/**
 * Validate model output with Zod, then run hallucination guard.
 * Never executes — caller decides ASK_OPERATOR / retry.
 */
export function parseAndValidateSalesBrainOutput(
  rawText: string,
  context: LlmContextLike
): SalesBrainParseResult {
  let raw: unknown;
  try {
    raw = extractJsonObject(rawText);
  } catch (error) {
    return {
      ok: false,
      code: "INVALID_JSON",
      error: String(error instanceof Error ? error.message : error)
    };
  }

  const parsed = ActionProposalModelSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      code: "SCHEMA",
      error: parsed.error.issues.map((i) => i.message).join("; "),
      raw
    };
  }

  const grounded = applyHallucinationGuard(parsed.data, context.product);
  if (!grounded.ok) {
    return {
      ok: false,
      code: "HALLUCINATION",
      error: grounded.reasons.join("; "),
      raw: grounded.proposal
    };
  }

  const intent =
    grounded.proposal.intent ??
    context.detectedIntent ??
    detectSalesCommentIntent(context.event);

  const proposal: ActionProposal = {
    id: newId(),
    createdAt: new Date().toISOString(),
    eventId: context.event.id,
    kind: grounded.proposal.kind,
    speech: grounded.proposal.speech,
    scene: grounded.proposal.scene,
    productRef: grounded.proposal.productRef ?? context.product?.id,
    confidence: grounded.proposal.confidence,
    reason: grounded.proposal.reason,
    riskTags: grounded.proposal.riskTags,
    nextState: grounded.proposal.nextState,
    metadata: {
      provider: "sales-brain",
      intent,
      schemaVersion: 1
    }
  };

  return { ok: true, proposal, model: grounded.proposal };
}

export function askOperatorFromSalesBrainFailure(
  context: LlmContextLike,
  failure: { code: SalesBrainParseFailureCode; error: string }
): ActionProposal {
  return {
    id: newId(),
    createdAt: new Date().toISOString(),
    eventId: context.event.id,
    kind: "ASK_OPERATOR",
    confidence: 1,
    reason: `Sales brain ${failure.code}: ${failure.error}`,
    riskTags: ["sales_brain_fallback", failure.code.toLowerCase()],
    nextState: "COMMENT_REPLY",
    metadata: {
      provider: "sales-brain",
      intent: context.detectedIntent ?? detectSalesCommentIntent(context.event),
      fallback: failure.code
    }
  };
}

/** Max model calls for invalid JSON/schema before ASK_OPERATOR. */
export const SALES_BRAIN_MAX_ATTEMPTS = 2;
