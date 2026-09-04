export type {
  ImportIssueCode,
  ImportPreviewRow,
  ImportRowDecision,
  ImportSourceKind,
  ParsedImportItem,
  ProductCsvColumn,
  ProductEnrichmentProvider,
  ProductEnrichmentRequest,
  ProductEnrichmentResult,
  ProductImportDraft,
  ProductImporter
} from "./types";
export { PRODUCT_CSV_COLUMNS } from "./types";
export { PRODUCT_CSV_TEMPLATE, CsvProductImporter, parseDelimited } from "./csv";
export { PasteTextProductImporter } from "./paste-text";
export { UrlProductImporter } from "./url-stub";
export {
  buildImportPreview,
  draftToProduct,
  findDuplicate,
  parseFaq,
  parseVariants,
  splitList
} from "./map";
export {
  enrichProductDraft,
  GeminiProductEnrichmentProvider,
  getProductEnrichmentProvider,
  NoopProductEnrichmentProvider,
  setProductEnrichmentProvider
} from "./enrichment";

import { CsvProductImporter, PRODUCT_CSV_TEMPLATE } from "./csv";
import { PasteTextProductImporter } from "./paste-text";
import { buildImportPreview, draftToProduct, parseVariants } from "./map";
import { emptyProductDraft } from "../product-dna";

// ponytail: assert self-check; upgrade when a real test runner lands
export function assertProductImportHelpers(): void {
  const csv = new CsvProductImporter().parse(PRODUCT_CSV_TEMPLATE);
  if (csv.length < 2) throw new Error("csv template parse failed");
  const preview = buildImportPreview(csv, "csv", [
    emptyProductDraft({ title: "Áo thun cotton", priceText: "1" })
  ]);
  const dup = preview.find((r) => r.product.title === "Áo thun cotton");
  if (!dup?.duplicateOf || dup.decision !== "skip") {
    throw new Error("duplicate title should default to skip");
  }
  const variants = parseVariants("Size:S|M; Color:Đen|Trắng");
  if (variants.length !== 2 || variants[0]!.values.length !== 2) {
    throw new Error("variant parse failed");
  }
  const paste = new PasteTextProductImporter().parse(
    "Tên: Túi tote\nGiá: 150.000đ\nMàu: Be|Đen\n"
  );
  if (paste.length !== 1 || draftToProduct(paste[0]!.draft).title !== "Túi tote") {
    throw new Error("paste keyed parse failed");
  }
}
