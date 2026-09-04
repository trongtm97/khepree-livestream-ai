import type { ProductDNA, ProductFaq, ProductVariant } from "./live-types";

export type ProductCompletenessKey =
  | "sourceUrl"
  | "price"
  | "currency"
  | "description"
  | "highlights"
  | "benefits"
  | "materials"
  | "sizes"
  | "colors"
  | "variants"
  | "stock"
  | "shipping"
  | "warranty"
  | "faq"
  | "allowedClaims"
  | "forbiddenClaims"
  | "aiNotes";

export interface ProductCompleteness {
  percent: number;
  filled: ProductCompletenessKey[];
  missing: ProductCompletenessKey[];
}

export interface ProductValidation {
  ok: boolean;
  errors: Partial<Record<"title" | "priceText" | "sourceUrl", string>>;
}

const COMPLETENESS_CHECKS: Array<{
  key: ProductCompletenessKey;
  present: (p: ProductDNA) => boolean;
}> = [
  { key: "sourceUrl", present: (p) => Boolean(p.sourceUrl?.trim()) },
  { key: "price", present: (p) => Boolean(p.priceText?.trim()) },
  { key: "currency", present: (p) => Boolean(p.currency?.trim()) },
  { key: "description", present: (p) => Boolean(p.description?.trim()) },
  { key: "highlights", present: (p) => p.facts.length > 0 },
  { key: "benefits", present: (p) => p.benefits.length > 0 },
  { key: "materials", present: (p) => Boolean(p.materials?.trim()) },
  { key: "sizes", present: (p) => p.sizes.length > 0 },
  { key: "colors", present: (p) => p.colors.length > 0 },
  { key: "variants", present: (p) => p.variants.some((v) => v.name.trim() && v.values.length > 0) },
  { key: "stock", present: (p) => Boolean(p.stockText?.trim()) },
  { key: "shipping", present: (p) => Boolean(p.shippingText?.trim()) },
  { key: "warranty", present: (p) => Boolean(p.warrantyText?.trim()) },
  { key: "faq", present: (p) => p.faq.some((f) => f.question.trim() && f.answer.trim()) },
  { key: "allowedClaims", present: (p) => p.allowedClaims.length > 0 },
  { key: "forbiddenClaims", present: (p) => p.forbiddenClaims.length > 0 },
  { key: "aiNotes", present: (p) => Boolean(p.aiNotes?.trim()) }
];

export function emptyProductDraft(partial?: Partial<ProductDNA>): ProductDNA {
  return normalizeProduct({
    id: partial?.id ?? crypto.randomUUID(),
    title: "",
    facts: [],
    benefits: [],
    sizes: [],
    colors: [],
    variants: [],
    allowedClaims: [],
    forbiddenClaims: [],
    faq: [],
    updatedAt: new Date().toISOString(),
    ...partial
  });
}

export function normalizeProduct(raw: Partial<ProductDNA> & { id: string; title: string }): ProductDNA {
  return {
    id: raw.id,
    title: String(raw.title ?? "").trim(),
    sourceUrl: trimOrUndefined(raw.sourceUrl),
    description: trimOrUndefined(raw.description),
    priceText: trimOrUndefined(raw.priceText),
    currency: trimOrUndefined(raw.currency),
    facts: normalizeStringList(raw.facts),
    benefits: normalizeStringList(raw.benefits),
    materials: trimOrUndefined(raw.materials),
    sizes: normalizeStringList(raw.sizes),
    colors: normalizeStringList(raw.colors),
    variants: normalizeVariants(raw.variants),
    stockText: trimOrUndefined(raw.stockText),
    shippingText: trimOrUndefined(raw.shippingText),
    warrantyText: trimOrUndefined(raw.warrantyText),
    faq: normalizeFaq(raw.faq),
    allowedClaims: normalizeStringList(raw.allowedClaims),
    forbiddenClaims: normalizeStringList(raw.forbiddenClaims),
    aiNotes: trimOrUndefined(raw.aiNotes),
    updatedAt: raw.updatedAt ?? new Date().toISOString()
  };
}

/** Accept common display prices: "299.000đ", "$19.99", "19,99 EUR". Empty is allowed. */
export function isValidPriceText(value: string | undefined): boolean {
  const text = value?.trim() ?? "";
  if (!text) return true;
  if (!/\d/.test(text)) return false;
  // Reject if digits appear only as noise inside a long prose sentence without a price-like shape.
  if (text.length > 40) return false;
  // Must not be purely alphabetic after stripping currency symbols and separators.
  const core = text.replace(/[^\d.,]/g, "");
  if (!core) return false;
  const normalized = core.replace(/,/g, ".").replace(/\.(?=.*\.)/g, "");
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) return false;
  return true;
}

export function isValidSourceUrl(value: string | undefined): boolean {
  const text = value?.trim() ?? "";
  if (!text) return true;
  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateProduct(product: Pick<ProductDNA, "title" | "priceText" | "sourceUrl">): ProductValidation {
  const errors: ProductValidation["errors"] = {};
  if (!product.title.trim()) errors.title = "TITLE_REQUIRED";
  if (!isValidPriceText(product.priceText)) errors.priceText = "PRICE_INVALID";
  if (!isValidSourceUrl(product.sourceUrl)) errors.sourceUrl = "SOURCE_URL_INVALID";
  return { ok: Object.keys(errors).length === 0, errors };
}

export function computeProductCompleteness(product: ProductDNA): ProductCompleteness {
  const filled: ProductCompletenessKey[] = [];
  const missing: ProductCompletenessKey[] = [];
  for (const check of COMPLETENESS_CHECKS) {
    if (check.present(product)) filled.push(check.key);
    else missing.push(check.key);
  }
  const percent = Math.round((filled.length / COMPLETENESS_CHECKS.length) * 100);
  return { percent, filled, missing };
}

export function duplicateProduct(source: ProductDNA, titleSuffix = " (bản sao)"): ProductDNA {
  return normalizeProduct({
    ...source,
    id: crypto.randomUUID(),
    title: `${source.title}${titleSuffix}`.trim(),
    updatedAt: new Date().toISOString()
  });
}

/** True when DNA has enough data to answer a shopper question about this topic. */
export function productHasFact(
  product: ProductDNA | undefined,
  topic: "price" | "size" | "color" | "stock" | "shipping" | "warranty" | "materials"
): boolean {
  if (!product) return false;
  switch (topic) {
    case "price":
      return Boolean(product.priceText?.trim());
    case "size":
      return product.sizes.length > 0 || variantNamed(product, /size|kích|cỡ/i);
    case "color":
      return product.colors.length > 0 || variantNamed(product, /màu|color/i);
    case "stock":
      return Boolean(product.stockText?.trim());
    case "shipping":
      return Boolean(product.shippingText?.trim());
    case "warranty":
      return Boolean(product.warrantyText?.trim());
    case "materials":
      return Boolean(product.materials?.trim());
    default:
      return false;
  }
}

function variantNamed(product: ProductDNA, re: RegExp): boolean {
  return product.variants.some((v) => re.test(v.name) && v.values.length > 0);
}

function trimOrUndefined(value: string | undefined): string | undefined {
  const text = value?.trim() ?? "";
  return text || undefined;
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function normalizeVariants(value: unknown): ProductVariant[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const row = item as Partial<ProductVariant>;
      return {
        name: String(row?.name ?? "").trim(),
        values: normalizeStringList(row?.values)
      };
    })
    .filter((v) => v.name || v.values.length > 0);
}

function normalizeFaq(value: unknown): ProductFaq[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const row = item as Partial<ProductFaq>;
      return {
        question: String(row?.question ?? "").trim(),
        answer: String(row?.answer ?? "").trim()
      };
    })
    .filter((f) => f.question || f.answer);
}

// ponytail: assert-based self-check; upgrade to vitest when suite exists
export function assertProductDnaHelpers(): void {
  const incomplete = emptyProductDraft({ title: "Áo" });
  const c0 = computeProductCompleteness(incomplete);
  if (c0.percent !== 0 || !c0.missing.includes("price")) {
    throw new Error("completeness empty product failed");
  }
  if (!validateProduct({ title: "", priceText: "" }).errors.title) {
    throw new Error("title required failed");
  }
  if (validateProduct({ title: "Áo", priceText: "abc" }).ok) {
    throw new Error("invalid price should fail");
  }
  if (!validateProduct({ title: "Áo", priceText: "299.000đ" }).ok) {
    throw new Error("valid VND price should pass");
  }
  if (productHasFact(incomplete, "price")) throw new Error("missing price should be false");
  const full = normalizeProduct({
    ...incomplete,
    priceText: "100.000đ",
    currency: "VND",
    sourceUrl: "https://example.com/p",
    description: "desc",
    facts: ["mềm"],
    benefits: ["thoáng"],
    materials: "cotton",
    sizes: ["M"],
    colors: ["đen"],
    variants: [{ name: "Kiểu", values: ["cổ tròn"] }],
    stockText: "còn",
    shippingText: "2 ngày",
    warrantyText: "7 ngày",
    faq: [{ question: "Giặt?", answer: "Máy" }],
    allowedClaims: ["cotton 100%"],
    forbiddenClaims: ["chữa bệnh"],
    aiNotes: "nhấn mạnh mềm"
  });
  if (computeProductCompleteness(full).percent !== 100) {
    throw new Error("full product should be 100%");
  }
}
