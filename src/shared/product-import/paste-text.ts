import type { ParsedImportItem, ProductImportDraft, ProductImporter } from "./types";
import { CsvProductImporter, parseDelimited } from "./csv";
import { PRODUCT_CSV_COLUMNS } from "./types";

const KEY_ALIASES: Record<string, keyof ProductImportDraft> = {
  title: "title",
  name: "title",
  "tên": "title",
  "ten": "title",
  "tên sản phẩm": "title",
  price: "price",
  "giá": "price",
  gia: "price",
  currency: "currency",
  "tiền tệ": "currency",
  description: "description",
  "mô tả": "description",
  "mo ta": "description",
  variants: "variants",
  "biến thể": "variants",
  sizes: "sizes",
  size: "sizes",
  "kích thước": "sizes",
  colors: "colors",
  color: "colors",
  "màu": "colors",
  mau: "colors",
  shipping: "shipping",
  "giao hàng": "shipping",
  "giao hang": "shipping",
  warranty: "warranty",
  "bảo hành": "warranty",
  "bao hanh": "warranty",
  faq: "faq",
  url: "sourceUrl",
  "source url": "sourceUrl",
  sourceurl: "sourceUrl",
  "nguồn": "sourceUrl"
};

/**
 * Paste importer:
 * 1) If text looks like CSV/TSV with a header row → reuse CSV parser (Excel paste).
 * 2) Else key:value / key - value lines.
 * 3) Else first non-empty line = title, rest = description + rawText.
 */
export class PasteTextProductImporter implements ProductImporter {
  readonly kind = "paste" as const;

  parse(input: string): ParsedImportItem[] {
    const text = input.replace(/^\uFEFF/, "").trim();
    if (!text) return [];

    if (looksLikeTable(text)) {
      return new CsvProductImporter().parse(text);
    }

    const keyed = parseKeyedBlocks(text);
    if (keyed.length > 0) return keyed;

    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const title = lines[0] ?? "";
    const rest = lines.slice(1).join("\n");
    const priceMatch = text.match(/(?:giá|price)\s*[:：]?\s*([0-9][0-9.,\s]*[^\s\n]{0,8})/i);
    const draft: ProductImportDraft = {
      title,
      description: rest || undefined,
      price: priceMatch?.[1]?.trim(),
      rawText: text
    };
    return [{ draft, warnings: ["Parsed as freeform paste — review before import"] }];
  }
}

function looksLikeTable(text: string): boolean {
  const first = text.split(/\r?\n/).find((l) => l.trim()) ?? "";
  const lower = first.toLowerCase();
  const hasTitle = /\btitle\b|\btên\b|\bten\b/.test(lower);
  if (!hasTitle) return false;
  const rows = parseDelimited(text);
  if (rows.length < 2) return false;
  const header = rows[0]!.map((c) => c.trim().toLowerCase());
  return header.some((h) => PRODUCT_CSV_COLUMNS.includes(h as (typeof PRODUCT_CSV_COLUMNS)[number]) || h === "title" || h === "tên");
}

function parseKeyedBlocks(text: string): ParsedImportItem[] {
  const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const items: ParsedImportItem[] = [];

  for (const block of blocks) {
    const draft: ProductImportDraft = {};
    let matched = 0;
    for (const line of block.split(/\r?\n/)) {
      const m = /^\s*([^:：\-=]{1,40})\s*[:：\-=]\s*(.+)\s*$/.exec(line);
      if (!m) continue;
      const key = m[1]!.trim().toLowerCase();
      const value = m[2]!.trim();
      const field = KEY_ALIASES[key];
      if (!field) continue;
      draft[field] = value;
      matched += 1;
    }
    if (matched >= 1 && (draft.title || draft.description || draft.price)) {
      if (!draft.title) {
        const firstLine = block.split(/\r?\n/).map((l) => l.trim()).find(Boolean);
        draft.title = firstLine;
      }
      draft.rawText = block;
      items.push({ draft, warnings: [] });
    }
  }
  return items;
}
