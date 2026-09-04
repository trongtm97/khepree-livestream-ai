import {
  FIXTURE_HALLUCINATION_JSON,
  FIXTURE_INVALID_JSON,
  FIXTURE_MEDICAL_JSON,
  FIXTURE_PRODUCT_THIN,
  FIXTURE_SCHEMA_INVALID_JSON,
  FIXTURE_VALID_JSON,
  fixtureContext
} from "./fixtures";
import { buildSalesBrainPrompt } from "./prompt";
import {
  extractJsonObject,
  parseAndValidateSalesBrainOutput
} from "./parse";
import { ActionProposalModelSchema } from "./schema";
import { applyHallucinationGuard } from "./grounding";

export function assertSalesBrainContract(): void {
  // Schema: valid fixture
  const validRaw = extractJsonObject(FIXTURE_VALID_JSON);
  const schemaOk = ActionProposalModelSchema.safeParse(validRaw);
  if (!schemaOk.success) throw new Error("valid fixture failed schema");

  // Schema: invalid SPEAK without speech
  const schemaBad = ActionProposalModelSchema.safeParse(
    extractJsonObject(FIXTURE_SCHEMA_INVALID_JSON)
  );
  if (schemaBad.success) throw new Error("schema should reject SPEAK without speech");

  // Invalid JSON
  let threw = false;
  try {
    extractJsonObject(FIXTURE_INVALID_JSON);
  } catch {
    threw = true;
  }
  if (!threw) throw new Error("invalid JSON should throw");

  // Pipeline: valid grounded
  const ctx = fixtureContext();
  const ok = parseAndValidateSalesBrainOutput(FIXTURE_VALID_JSON, ctx);
  if (!ok.ok || ok.proposal.kind !== "SPEAK") {
    throw new Error("valid fixture should produce SPEAK proposal");
  }

  // Pipeline: invalid → not ok (do not execute)
  const badJson = parseAndValidateSalesBrainOutput(FIXTURE_INVALID_JSON, ctx);
  if (badJson.ok || badJson.code !== "INVALID_JSON") {
    throw new Error("invalid JSON must fail with INVALID_JSON");
  }

  const badSchema = parseAndValidateSalesBrainOutput(FIXTURE_SCHEMA_INVALID_JSON, ctx);
  if (badSchema.ok || badSchema.code !== "SCHEMA") {
    throw new Error("schema-invalid fixture must fail SCHEMA");
  }

  // Hallucination guard: invented price on thin product
  const thinCtx = fixtureContext(FIXTURE_PRODUCT_THIN);
  const hallu = parseAndValidateSalesBrainOutput(FIXTURE_HALLUCINATION_JSON, thinCtx);
  if (hallu.ok || hallu.code !== "HALLUCINATION") {
    throw new Error("hallucinated price must fail HALLUCINATION");
  }

  const medical = applyHallucinationGuard(
    ActionProposalModelSchema.parse(extractJsonObject(FIXTURE_MEDICAL_JSON)),
    FIXTURE_PRODUCT_THIN
  );
  if (medical.ok) throw new Error("medical claim must be blocked");

  // Prompt must include grounding rules + DNA
  const prompt = buildSalesBrainPrompt(ctx);
  for (const needle of [
    "NEVER invent price",
    "PRODUCT_DNA=",
    "RECENT_COMMENTS=",
    "RECENT_CTA=",
    "RECENT_RESPONDED_COMMENTS=",
    "ANTI_REPETITION",
    "POLICY_CONTEXT=",
    "ASK_OPERATOR"
  ]) {
    if (!prompt.includes(needle) && needle !== "ANTI_REPETITION") {
      // ANTI_REPETITION only when hint set — check rule instead
    }
    if (needle === "ANTI_REPETITION") {
      if (!prompt.includes("Do NOT repeat recent speech")) {
        throw new Error("prompt missing anti-repetition rule");
      }
      continue;
    }
    if (!prompt.includes(needle)) throw new Error(`prompt missing ${needle}`);
  }
}

// Runnable via: npx tsx src/shared/sales-brain/self-check.ts
const entry = typeof process !== "undefined" ? process.argv[1] ?? "" : "";
if (/sales-brain[\\/]+self-check\.(ts|js)$/.test(entry.replace(/\\/g, "/"))) {
  assertSalesBrainContract();
  console.log("sales-brain self-check PASS");
}
