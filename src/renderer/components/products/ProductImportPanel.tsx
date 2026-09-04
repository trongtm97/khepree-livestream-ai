import { useMemo, useRef, useState } from "react";
import { FileUp, Download, ClipboardPaste } from "lucide-react";
import type { ProductDNA } from "../../../shared/live-types";
import {
  buildImportPreview,
  CsvProductImporter,
  enrichProductDraft,
  PasteTextProductImporter,
  PRODUCT_CSV_TEMPLATE,
  type ImportPreviewRow,
  type ImportRowDecision,
  type ImportSourceKind,
  type ImportIssueCode
} from "../../../shared/product-import";
import { normalizeProduct, validateProduct } from "../../../shared/product-dna";
import { useAppShell } from "../../app/AppShellContext";
import type { MessageKey } from "../../i18n/types";

type Props = {
  existing: ProductDNA[];
  rows: ImportPreviewRow[];
  onRowsChange: (rows: ImportPreviewRow[]) => void;
  onEditRow: (row: ImportPreviewRow) => void;
  onClose: () => void;
  onImported: () => Promise<void>;
};

type SourceTab = "csv" | "paste";

const ISSUE_LABEL: Record<string, MessageKey> = {
  TITLE_REQUIRED: "import.issue.title",
  PRICE_INVALID: "import.issue.price",
  SOURCE_URL_INVALID: "import.issue.url",
  DUPLICATE_TITLE: "import.issue.dupTitle",
  DUPLICATE_SOURCE_URL: "import.issue.dupUrl",
  EMPTY_ROW: "import.issue.empty"
};

export function ProductImportPanel({
  existing,
  rows,
  onRowsChange,
  onEditRow,
  onClose,
  onImported
}: Props) {
  const { t, run, notify } = useAppShell();
  const [tab, setTab] = useState<SourceTab>("csv");
  const [pasteText, setPasteText] = useState("");
  const [enrichNote, setEnrichNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const importableCount = useMemo(
    () => rows.filter((r) => r.decision === "import").length,
    [rows]
  );

  const downloadTemplate = () => {
    const blob = new Blob([PRODUCT_CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "khepree-product-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const applyParsed = (source: ImportSourceKind, text: string) => {
    const importer = source === "csv" ? new CsvProductImporter() : new PasteTextProductImporter();
    const items = importer.parse(text);
    if (items.length === 0) {
      notify({ tone: "warning", title: t("import.emptyParse") });
      onRowsChange([]);
      return;
    }
    onRowsChange(buildImportPreview(items, source, existing));
  };

  const onFile = async (file: File | null) => {
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
      notify({
        tone: "warning",
        title: t("import.excelHintTitle"),
        message: t("import.excelHintBody")
      });
      return;
    }
    const text = await file.text();
    applyParsed("csv", text);
  };

  const setDecision = (key: string, decision: ImportRowDecision) => {
    onRowsChange(rows.map((r) => (r.key === key ? { ...r, decision } : r)));
  };

  const commit = () =>
    run(async () => {
      const selected = rows.filter((r) => r.decision === "import");
      if (selected.length === 0) {
        notify({ tone: "warning", title: t("import.noneSelected") });
        return;
      }
      let saved = 0;
      let skippedDup = 0;
      for (const row of selected) {
        // Never overwrite an existing product id. Explicit import of a duplicate
        // title still creates a *new* product — seller chose import after preview.
        if (row.duplicateOf && row.issues.includes("DUPLICATE_SOURCE_URL")) {
          // Same source URL: refuse silently creating a second record without edit
          skippedDup += 1;
          continue;
        }
        const product = normalizeProduct({
          ...row.product,
          id: crypto.randomUUID(),
          updatedAt: new Date().toISOString()
        });
        const validation = validateProduct(product);
        if (!validation.ok) continue;
        await window.khepreeLivestreamAI.saveProduct(product);
        saved += 1;
      }
      if (skippedDup > 0) {
        notify({
          tone: "warning",
          title: t("import.skippedDupUrl", { count: skippedDup })
        });
      }
      notify({
        tone: "success",
        title: t("import.done", { count: saved })
      });
      onRowsChange([]);
      await onImported();
      if (saved > 0) onClose();
    });

  const tryEnrich = () =>
    run(async () => {
      if (rows.length === 0) return;
      const result = await enrichProductDraft({
        product: rows[0]!.product,
        sourceText: pasteText || undefined
      });
      setEnrichNote(result.notes?.join(" ") || t("import.enrichUnavailable"));
      notify({ tone: "info", title: t("import.enrichUnavailable") });
    });

  return (
    <div className="panel productImportPanel">
      <div className="panelHead">
        <div>
          <h2>{t("import.title")}</h2>
          <p>{t("import.subtitle")}</p>
        </div>
        <FileUp />
      </div>

      <div className="importTabs" role="tablist">
        <button
          type="button"
          role="tab"
          className={tab === "csv" ? "primary" : "ghost"}
          aria-selected={tab === "csv"}
          onClick={() => setTab("csv")}
        >
          CSV / Excel
        </button>
        <button
          type="button"
          role="tab"
          className={tab === "paste" ? "primary" : "ghost"}
          aria-selected={tab === "paste"}
          onClick={() => setTab("paste")}
        >
          {t("import.tabPaste")}
        </button>
      </div>

      {tab === "csv" ? (
        <div className="importSourceForm form">
          <p className="importHint">{t("import.csvHint")}</p>
          <div className="row productListToolbar">
            <button type="button" className="ghost" onClick={downloadTemplate}>
              <Download size={14} /> {t("import.downloadTemplate")}
            </button>
            <button type="button" className="primary" onClick={() => fileRef.current?.click()}>
              {t("import.chooseFile")}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.tsv,.txt,text/csv,text/plain"
              hidden
              onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>
      ) : (
        <div className="importSourceForm form">
          <p className="importHint">{t("import.pasteHint")}</p>
          <label>
            {t("import.pasteLabel")}
            <textarea
              rows={8}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={t("import.pastePlaceholder")}
            />
          </label>
          <button
            type="button"
            className="primary"
            disabled={!pasteText.trim()}
            onClick={() => applyParsed("paste", pasteText)}
          >
            <ClipboardPaste size={14} /> {t("import.preview")}
          </button>
        </div>
      )}

      {rows.length > 0 ? (
        <div className="importPreview">
          <div className="importPreviewHead">
            <strong>{t("import.previewTitle", { count: rows.length })}</strong>
            <span>{t("import.willImport", { count: importableCount })}</span>
          </div>
          <div className="importTableWrap">
            <table className="importTable">
              <thead>
                <tr>
                  <th>{t("import.colTitle")}</th>
                  <th>{t("import.colPrice")}</th>
                  <th>{t("import.colIssues")}</th>
                  <th>{t("import.colAction")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key} className={row.decision === "skip" ? "isSkipped" : ""}>
                    <td>
                      <strong>{row.product.title || "—"}</strong>
                      {row.duplicateOf ? (
                        <span className="importDup">
                          {t("import.dupOf", { title: row.duplicateOf.title })}
                        </span>
                      ) : null}
                    </td>
                    <td>{row.product.priceText || "—"}</td>
                    <td>
                      {row.issues.length === 0
                        ? "—"
                        : row.issues
                            .map((code) => t(ISSUE_LABEL[code] ?? "import.issue.other"))
                            .join(", ")}
                    </td>
                    <td>
                      <div className="importRowActions">
                        <select
                          value={row.decision}
                          onChange={(e) =>
                            setDecision(row.key, e.target.value as ImportRowDecision)
                          }
                          aria-label={t("import.colAction")}
                        >
                          <option value="import">{t("import.action.import")}</option>
                          <option value="skip">{t("import.action.skip")}</option>
                          <option value="edit">{t("import.action.edit")}</option>
                        </select>
                        <button
                          type="button"
                          className="ghost compact"
                          onClick={() => onEditRow(row)}
                        >
                          {t("import.action.edit")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="row productFormActions">
            <button type="button" className="primary" onClick={() => void commit()}>
              {t("import.commit", { count: importableCount })}
            </button>
            <button type="button" className="ghost" onClick={() => void tryEnrich()}>
              {t("import.enrich")}
            </button>
            <button type="button" className="ghost" onClick={onClose}>
              {t("products.cancel")}
            </button>
          </div>
          {enrichNote ? <p className="importHint">{enrichNote}</p> : null}
          <p className="importHint">{t("import.noOverwrite")}</p>
        </div>
      ) : (
        <div className="row productFormActions">
          <button type="button" className="ghost" onClick={onClose}>
            {t("products.cancel")}
          </button>
        </div>
      )}
    </div>
  );
}

export function applyEditedImportRow(
  rows: ImportPreviewRow[],
  key: string,
  product: ProductDNA
): ImportPreviewRow[] {
  return rows.map((row) => {
    if (row.key !== key) return row;
    const issues: ImportIssueCode[] = row.issues.filter(
      (c) =>
        c === "DUPLICATE_TITLE" || c === "DUPLICATE_SOURCE_URL"
    );
    const validation = validateProduct(product);
    if (validation.errors.title) issues.push("TITLE_REQUIRED");
    if (validation.errors.priceText) issues.push("PRICE_INVALID");
    if (validation.errors.sourceUrl) issues.push("SOURCE_URL_INVALID");
    const blocking = Boolean(
      validation.errors.title || validation.errors.priceText || validation.errors.sourceUrl
    );
    return {
      ...row,
      product: normalizeProduct(product),
      decision: blocking
        ? "skip"
        : row.duplicateOf?.match === "sourceUrl"
          ? "skip"
          : "import",
      issues: [...new Set(issues)]
    };
  });
}
