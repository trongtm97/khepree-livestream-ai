import type { ParsedImportItem, ProductImporter } from "./types";

/**
 * Stub for future TikTok / storefront URL import.
 * V1 keeps the adapter slot without implementing scrape/DOM selectors.
 */
export class UrlProductImporter implements ProductImporter {
  readonly kind = "url" as const;

  parse(_input: string): ParsedImportItem[] {
    throw new Error("PRODUCT_URL_IMPORT_NOT_ENABLED");
  }
}
