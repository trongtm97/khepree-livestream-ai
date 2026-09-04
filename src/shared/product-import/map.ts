import { emptyProductDraft, normalizeProduct, validateProduct } from "../product-dna";
import type { ProductDNA, ProductFaq, ProductVariant } from "../live-types";
import type {
  ImportIssueCode,
  ImportPreviewRow,
  ImportSourceKind,
  ParsedImportItem,
  ProductImportDraft
} from "./types";

export function draftToProduct(draft: ProductImportDraft, id?: string): ProductDNA {
  return normalizeProduct(
    emptyProductDraft({
      id,
      title: draft.title?.trim() ?? "",
      sourceUrl: draft.sourceUrl,
      priceText: draft.price,
      currency: draft.currency,
      description: draft.description,
      sizes: splitList(draft.sizes),
      colors: splitList(draft.colors),
      variants: parseVariants(draft.variants),
      shippingText: draft.shipping,
      warrantyText: draft.warranty,
      faq: parseFaq(draft.faq),
      aiNotes: draft.rawText ? `Imported notes:\n${draft.rawText.slice(0, 500)}` : undefined
    })
  );
}

export function findDuplicate(
  candidate: ProductDNA,
  existing: ProductDNA[]
): ImportPreviewRow["duplicateOf"] | undefined {
  const titleKey = normalizeTitle(candidate.title);
  const urlKey = normalizeUrl(candidate.sourceUrl);
  for (const product of existing) {
    if (urlKey && normalizeUrl(product.sourceUrl) === urlKey) {
      return { id: product.id, title: product.title, match: "sourceUrl" };
    }
  }
  if (!titleKey) return undefined;
  for (const product of existing) {
    if (normalizeTitle(product.title) === titleKey) {
      return { id: product.id, title: product.title, match: "title" };
    }
  }
  return undefined;
}

export function buildImportPreview(
  items: ParsedImportItem[],
  source: ImportSourceKind,
  existing: ProductDNA[]
): ImportPreviewRow[] {
  return items.map((item, index) => {
    const product = draftToProduct(item.draft);
    const validation = validateProduct(product);
    const issues: ImportIssueCode[] = [];
    if (!product.title.trim() && !hasAnyContent(item.draft)) {
      issues.push("EMPTY_ROW");
    }
    if (validation.errors.title) issues.push("TITLE_REQUIRED");
    if (validation.errors.priceText) issues.push("PRICE_INVALID");
    if (validation.errors.sourceUrl) issues.push("SOURCE_URL_INVALID");

    const duplicateOf = findDuplicate(product, existing);
    if (duplicateOf?.match === "title") issues.push("DUPLICATE_TITLE");
    if (duplicateOf?.match === "sourceUrl") issues.push("DUPLICATE_SOURCE_URL");

    const blocking = issues.includes("TITLE_REQUIRED") || issues.includes("EMPTY_ROW")
      || issues.includes("PRICE_INVALID")
      || issues.includes("SOURCE_URL_INVALID");
    const decision = blocking || duplicateOf ? "skip" : "import";

    return {
      key: `import-${source}-${index}-${product.id}`,
      source,
      product,
      decision,
      issues,
      duplicateOf
    };
  });
}

function hasAnyContent(draft: ProductImportDraft): boolean {
  return Object.values(draft).some((v) => typeof v === "string" && v.trim().length > 0);
}

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeUrl(url: string | undefined): string | undefined {
  const text = url?.trim().toLowerCase();
  if (!text) return undefined;
  return text.replace(/\/+$/, "");
}

/** sizes/colors: comma, pipe, or semicolon. */
export function splitList(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(/[,|;/]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * variants cell: `Size:S|M|L; Color:Đen|Trắng` or `Size=S|M|L`
 */
export function parseVariants(value: string | undefined): ProductVariant[] {
  if (!value?.trim()) return [];
  return value
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const sep = part.includes("=") ? "=" : ":";
      const idx = part.indexOf(sep);
      if (idx <= 0) return { name: part, values: [] as string[] };
      return {
        name: part.slice(0, idx).trim(),
        values: splitList(part.slice(idx + 1))
      };
    })
    .filter((v) => v.name);
}

/**
 * faq cell: `Giặt máy được không?|Có;; Có co giãn không?|Ít`
 */
export function parseFaq(value: string | undefined): ProductFaq[] {
  if (!value?.trim()) return [];
  return value
    .split(";;")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const idx = part.indexOf("|");
      if (idx < 0) return { question: part, answer: "" };
      return {
        question: part.slice(0, idx).trim(),
        answer: part.slice(idx + 1).trim()
      };
    })
    .filter((f) => f.question || f.answer);
}
