import type { ProductDNA } from "../live-types";

export type ImportSourceKind = "manual" | "csv" | "paste" | "url";

export type ImportRowDecision = "import" | "skip" | "edit";

export type ImportIssueCode =
  | "TITLE_REQUIRED"
  | "PRICE_INVALID"
  | "SOURCE_URL_INVALID"
  | "DUPLICATE_TITLE"
  | "DUPLICATE_SOURCE_URL"
  | "EMPTY_ROW";

export interface ProductImportDraft {
  /** Raw fields before ProductDNA normalization. */
  title?: string;
  sourceUrl?: string;
  price?: string;
  currency?: string;
  description?: string;
  variants?: string;
  sizes?: string;
  colors?: string;
  shipping?: string;
  warranty?: string;
  faq?: string;
  /** Freeform leftover text (paste adapter). */
  rawText?: string;
}

export interface ParsedImportItem {
  draft: ProductImportDraft;
  warnings: string[];
}

export interface ProductImporter {
  readonly kind: ImportSourceKind;
  parse(input: string): ParsedImportItem[];
}

export interface ImportPreviewRow {
  key: string;
  source: ImportSourceKind;
  product: ProductDNA;
  decision: ImportRowDecision;
  issues: ImportIssueCode[];
  duplicateOf?: {
    id: string;
    title: string;
    match: "title" | "sourceUrl";
  };
}

export interface ProductEnrichmentRequest {
  product: ProductDNA;
  /** Seller free text that may help Gemini fill missing fields. */
  sourceText?: string;
}

export interface ProductEnrichmentResult {
  /** Partial DNA patch — never invents regulated claims; caller merges. */
  patch: Partial<ProductDNA>;
  notes?: string[];
  provider: string;
}

/** Hook for future Gemini Product DNA enrichment. V1 may return empty. */
export interface ProductEnrichmentProvider {
  readonly id: string;
  available(): Promise<boolean>;
  enrich(request: ProductEnrichmentRequest): Promise<ProductEnrichmentResult>;
}

export const PRODUCT_CSV_COLUMNS = [
  "title",
  "price",
  "currency",
  "description",
  "variants",
  "sizes",
  "colors",
  "shipping",
  "warranty",
  "faq"
] as const;

export type ProductCsvColumn = (typeof PRODUCT_CSV_COLUMNS)[number];
