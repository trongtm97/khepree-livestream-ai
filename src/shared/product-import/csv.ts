import type { ParsedImportItem, ProductCsvColumn, ProductImportDraft, ProductImporter } from "./types";
import { PRODUCT_CSV_COLUMNS } from "./types";

const HEADER_ALIASES: Record<string, ProductCsvColumn> = {
  title: "title",
  name: "title",
  "tên": "title",
  "ten": "title",
  price: "price",
  "giá": "price",
  gia: "price",
  currency: "currency",
  "tiền tệ": "currency",
  "tien te": "currency",
  description: "description",
  "mô tả": "description",
  "mo ta": "description",
  variants: "variants",
  "biến thể": "variants",
  "bien the": "variants",
  sizes: "sizes",
  size: "sizes",
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
  faq: "faq"
};

export const PRODUCT_CSV_TEMPLATE = `${PRODUCT_CSV_COLUMNS.join(",")}
"Áo thun cotton","299.000đ",VND,"Áo thun mềm mại","Kiểu:cổ tròn|cổ tim","S|M|L","Đen|Trắng","Giao 1-3 ngày nội thành","Đổi trả 7 ngày","Giặt máy được không?|Có;; Có co giãn không?|Ít"
"Quần jeans","450.000đ",VND,"Jeans ống đứng","","28|29|30","Xanh đậm","","",""
`;

export class CsvProductImporter implements ProductImporter {
  readonly kind = "csv" as const;

  parse(input: string): ParsedImportItem[] {
    const rows = parseDelimited(input);
    if (rows.length === 0) return [];

    const header = rows[0]!.map((cell) => cell.trim().toLowerCase());
    const columnMap = mapHeader(header);
    if (!columnMap.includes("title") && !header.some((h) => HEADER_ALIASES[h] === "title")) {
      // No title column — treat first column as title if present
      if (header.length > 0) columnMap[0] = "title";
    }

    const items: ParsedImportItem[] = [];
    for (let i = 1; i < rows.length; i += 1) {
      const row = rows[i]!;
      if (row.every((cell) => !cell.trim())) continue;
      const draft: ProductImportDraft = {};
      const warnings: string[] = [];
      for (let c = 0; c < row.length; c += 1) {
        const col = columnMap[c];
        const value = row[c]?.trim() ?? "";
        if (!col) {
          if (value) warnings.push(`Unknown column index ${c}`);
          continue;
        }
        draft[col] = value;
      }
      // Map csv price → draft.price already; title required later
      items.push({ draft, warnings });
    }
    return items;
  }
}

function mapHeader(header: string[]): Array<ProductCsvColumn | undefined> {
  return header.map((raw) => {
    const aliased = HEADER_ALIASES[raw];
    if (aliased) return aliased;
    if ((PRODUCT_CSV_COLUMNS as readonly string[]).includes(raw)) return raw as ProductCsvColumn;
    return undefined;
  });
}

/** Minimal CSV/TSV parser (RFC4180-ish). Auto-detects comma vs tab from header line. */
export function parseDelimited(text: string): string[][] {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const firstLine = normalized.split("\n").find((l) => l.trim()) ?? "";
  const delimiter = detectDelimiter(firstLine);
  return parseWithDelimiter(normalized, delimiter);
}

function detectDelimiter(headerLine: string): "," | "\t" | ";" {
  const tabs = (headerLine.match(/\t/g) ?? []).length;
  const semis = (headerLine.match(/;/g) ?? []).length;
  const commas = countUnquoted(headerLine, ",");
  if (tabs > commas && tabs >= semis) return "\t";
  if (semis > commas && semis > tabs) return ";";
  return ",";
}

function countUnquoted(line: string, ch: string): number {
  let count = 0;
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && c === ch) count += 1;
  }
  return count;
}

function parseWithDelimiter(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const c = text[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      continue;
    }
    if (c === delimiter) {
      row.push(field);
      field = "";
      continue;
    }
    if (c === "\n") {
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      continue;
    }
    field += c;
  }
  row.push(field);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}
