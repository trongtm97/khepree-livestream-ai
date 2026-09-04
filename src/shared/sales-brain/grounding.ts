import type { ProductDNA } from "../live-types";
import { productHasFact } from "../product-dna";
import type { ActionProposalModel } from "./schema";

export type GroundingResult =
  | { ok: true; proposal: ActionProposalModel }
  | { ok: false; reasons: string[]; proposal: ActionProposalModel };

/**
 * Hallucination / grounding guard — Product DNA is the only fact source.
 * Does not execute; caller must ASK_OPERATOR when ok=false.
 */
export function applyHallucinationGuard(
  proposal: ActionProposalModel,
  product?: ProductDNA
): GroundingResult {
  if (proposal.kind === "ASK_OPERATOR" || proposal.kind === "IGNORE") {
    return { ok: true, proposal };
  }

  const speech = proposal.speech ?? "";
  const reasons: string[] = [];
  const riskTags = [...proposal.riskTags];

  if (/\b(chữa khỏi|cure|guaranteed cure|100%\s*hiệu quả|fda approved|được fda)\b/i.test(speech)) {
    reasons.push("medical_or_legal_claim");
    riskTags.push("medical");
  }

  if (product) {
    for (const forbidden of product.forbiddenClaims) {
      if (forbidden && speech.toLowerCase().includes(forbidden.toLowerCase())) {
        reasons.push(`forbidden_claim:${forbidden}`);
        riskTags.push("regulated_claim");
      }
    }
  }

  checkInventedFact(speech, product, "price", productHasFact(product, "price"), product?.priceText, reasons, riskTags);
  checkInventedFact(speech, product, "stock", productHasFact(product, "stock"), product?.stockText, reasons, riskTags);
  checkInventedFact(
    speech,
    product,
    "shipping",
    productHasFact(product, "shipping"),
    product?.shippingText,
    reasons,
    riskTags
  );
  checkInventedFact(
    speech,
    product,
    "warranty",
    productHasFact(product, "warranty"),
    product?.warrantyText,
    reasons,
    riskTags
  );

  if (looksLikeSizeClaim(speech)) {
    if (!productHasFact(product, "size")) {
      reasons.push("invented_size");
      riskTags.push("hallucinated_size");
    } else if (product && !sizeClaimGrounded(speech, product)) {
      reasons.push("size_not_in_dna");
      riskTags.push("hallucinated_size");
    }
  }

  if (looksLikePriceClaim(speech) && !productHasFact(product, "price")) {
    if (!reasons.includes("invented_price")) {
      reasons.push("invented_price");
      riskTags.push("hallucinated_price");
    }
  }

  const next = { ...proposal, riskTags: [...new Set(riskTags)] };
  if (reasons.length === 0) return { ok: true, proposal: next };
  return { ok: false, reasons, proposal: next };
}

function looksLikePriceClaim(speech: string): boolean {
  return (
    /\b(\d[\d.,]*)\s*(k|đ|vnd|đồng|\$|usd)\b/i.test(speech) ||
    /\b(giá|price)\b.{0,24}\d/i.test(speech) ||
    /\b\d[\d.,]*\s*(nghìn|triệu)\b/i.test(speech)
  );
}

function looksLikeStockClaim(speech: string): boolean {
  return /\b(còn hàng|hết hàng|in stock|out of stock|tồn kho|chỉ còn\s*\d)\b/i.test(speech);
}

function looksLikeShippingClaim(speech: string): boolean {
  return /\b(ship|shipping|giao hàng|miễn ship|free ship|vận chuyển|1-3 ngày|2-3 ngày)\b/i.test(
    speech
  );
}

function looksLikeWarrantyClaim(speech: string): boolean {
  return /\b(bảo hành|warranty|đổi trả|return policy)\b/i.test(speech);
}

function looksLikeSizeClaim(speech: string): boolean {
  return /\b(size|kích thước|cỡ)\b/i.test(speech);
}

function checkInventedFact(
  speech: string,
  product: ProductDNA | undefined,
  kind: "price" | "stock" | "shipping" | "warranty",
  hasFact: boolean,
  factText: string | undefined,
  reasons: string[],
  riskTags: string[]
): void {
  const looks =
    kind === "price"
      ? looksLikePriceClaim(speech)
      : kind === "stock"
        ? looksLikeStockClaim(speech)
        : kind === "shipping"
          ? looksLikeShippingClaim(speech)
          : looksLikeWarrantyClaim(speech);

  if (!looks) return;

  if (!hasFact) {
    reasons.push(`invented_${kind}`);
    riskTags.push(`hallucinated_${kind}`);
    return;
  }

  if (factText && !speechIncludesGroundedSnippet(speech, factText) && kind === "price") {
    // Price: require the DNA price token to appear when asserting a numeric price.
    if (/\d/.test(speech) && !digitsOverlap(speech, factText)) {
      reasons.push(`${kind}_not_in_dna`);
      riskTags.push(`hallucinated_${kind}`);
    }
  }
}

function speechIncludesGroundedSnippet(speech: string, fact: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const f = norm(fact);
  if (!f) return false;
  if (norm(speech).includes(f)) return true;
  // Allow partial: significant tokens of length >= 3
  const tokens = f.split(/[^a-z0-9à-ỹ]+/i).filter((t) => t.length >= 3);
  return tokens.length > 0 && tokens.every((t) => norm(speech).includes(t));
}

function digitsOverlap(speech: string, fact: string): boolean {
  const speechDigits = speech.replace(/\D+/g, "");
  const factDigits = fact.replace(/\D+/g, "");
  if (!factDigits) return true;
  return speechDigits.includes(factDigits) || factDigits.includes(speechDigits);
}

function sizeClaimGrounded(speech: string, product: ProductDNA): boolean {
  const allowed = new Set(
    [
      ...product.sizes,
      ...product.variants.filter((v) => /size|kích|cỡ/i.test(v.name)).flatMap((v) => v.values)
    ]
      .map((s) => s.toLowerCase().trim())
      .filter(Boolean)
  );
  if (allowed.size === 0) return false;

  // If speech only says "còn size không" without naming a size, allow.
  const named = [...allowed].filter((size) => speech.toLowerCase().includes(size));
  if (named.length > 0) return true;

  // Explicit size token like "size XL" not in DNA
  const match = speech.match(/\bsize\s*([a-z0-9]+)\b/i);
  if (match?.[1] && !allowed.has(match[1].toLowerCase())) return false;

  return !/\bsize\s*[smlx0-9]{1,4}\b/i.test(speech);
}
