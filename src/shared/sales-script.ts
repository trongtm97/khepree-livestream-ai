import type { ProductDNA } from "./live-types";

export const SCRIPT_CATEGORIES = [
  "WELCOME",
  "PRODUCT_INTRO",
  "FEATURE",
  "BENEFIT",
  "PRICE",
  "CTA",
  "THANK",
  "TRANSITION",
  "IDLE",
  "ORDER_REACTION",
  "GENERIC_REPLY"
] as const;

export type ScriptCategory = (typeof SCRIPT_CATEGORIES)[number];

export type SalesScriptPack = {
  locale: string;
  version: number;
  categories: Partial<Record<ScriptCategory, string[]>>;
};

const PLACEHOLDER_RE = /\{\{\s*product\.([a-zA-Z]+)\s*\}\}/g;

/** Resolve product template vars — missing facts stay undefined (never invent). */
export function resolveProductVars(
  product?: ProductDNA
): Record<string, string | undefined> {
  if (!product) {
    return {
      title: undefined,
      price: undefined,
      currency: undefined,
      highlight: undefined,
      benefit: undefined,
      materials: undefined,
      stock: undefined,
      shipping: undefined,
      warranty: undefined
    };
  }
  return {
    title: trim(product.title),
    price: trim(
      product.priceText
        ? `${product.priceText}${product.currency ? ` ${product.currency}` : ""}`
        : undefined
    ),
    currency: trim(product.currency),
    highlight: trim(product.facts[0]),
    benefit: trim(product.benefits[0]),
    materials: trim(product.materials),
    stock: trim(product.stockText),
    shipping: trim(product.shippingText),
    warranty: trim(product.warrantyText)
  };
}

/**
 * Substitute {{product.*}} only when every referenced var exists.
 * Returns null if any required placeholder is missing — caller must not speak that line.
 */
export function substituteScriptLine(
  template: string,
  product?: ProductDNA
): string | null {
  const vars = resolveProductVars(product);
  let missing = false;
  const out = template.replace(PLACEHOLDER_RE, (_m, key: string) => {
    const value = vars[key];
    if (!value) {
      missing = true;
      return "";
    }
    return value;
  });
  if (missing) return null;
  const cleaned = out.replace(/\s+/g, " ").trim();
  return cleaned.length > 0 ? cleaned : null;
}

export function listPlaceholders(template: string): string[] {
  const keys: string[] = [];
  for (const match of template.matchAll(PLACEHOLDER_RE)) {
    if (match[1]) keys.push(match[1]);
  }
  return keys;
}

function trim(value: string | undefined): string | undefined {
  const t = value?.trim();
  return t ? t : undefined;
}

// ponytail: self-check
export function assertSalesScriptHelpers(): void {
  const product = {
    id: "p1",
    title: "Áo thun",
    priceText: "299000",
    currency: "VND",
    facts: ["Cotton"],
    benefits: ["Thoáng"],
    sizes: [],
    colors: [],
    variants: [],
    faq: [],
    allowedClaims: [],
    forbiddenClaims: [],
    updatedAt: new Date().toISOString()
  };
  const ok = substituteScriptLine("Giá {{product.price}} cho {{product.title}}", product);
  if (ok !== "Giá 299000 VND cho Áo thun") throw new Error("substitute failed");
  const thin = { ...product, priceText: undefined, currency: undefined };
  if (substituteScriptLine("Giá {{product.price}}", thin) !== null) {
    throw new Error("missing price must not speak");
  }
}
