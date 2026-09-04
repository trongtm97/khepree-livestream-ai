export {
  ACTION_KINDS,
  LIVE_STATES,
  SALES_COMMENT_INTENTS,
  ActionProposalModelSchema,
  type ActionProposalModel,
  type SalesCommentIntent
} from "./schema";
export { detectSalesCommentIntent } from "./intent";
export { buildSalesBrainPrompt } from "./prompt";
export {
  extractJsonObject,
  parseAndValidateSalesBrainOutput,
  askOperatorFromSalesBrainFailure,
  SALES_BRAIN_MAX_ATTEMPTS,
  type SalesBrainParseResult,
  type SalesBrainParseFailureCode
} from "./parse";
export { applyHallucinationGuard } from "./grounding";
export type { LlmContextLike } from "./types";
export {
  FIXTURE_VALID_JSON,
  FIXTURE_INVALID_JSON,
  FIXTURE_SCHEMA_INVALID_JSON,
  FIXTURE_HALLUCINATION_JSON,
  FIXTURE_MEDICAL_JSON,
  FIXTURE_PRODUCT_GROUNDED,
  FIXTURE_PRODUCT_THIN,
  fixtureContext
} from "./fixtures";
export { assertSalesBrainContract } from "./self-check";
