import { useMemo, type ReactNode } from "react";
import { Package, Plus, Trash2 } from "lucide-react";
import type { ProductDNA, ProductFaq, ProductVariant } from "../../../shared/live-types";
import {
  computeProductCompleteness,
  isValidPriceText,
  isValidSourceUrl,
  type ProductCompletenessKey
} from "../../../shared/product-dna";
import { useAppShell } from "../../app/AppShellContext";
import type { MessageKey } from "../../i18n/types";
import { MicroHelp } from "../help/MicroHelp";

export type ProductFormMode = "create" | "edit" | "view";

type Props = {
  draft: ProductDNA;
  mode: ProductFormMode;
  onChange: (next: ProductDNA) => void;
  onSave: () => void;
  onCancel: () => void;
};

const MISSING_LABEL: Record<ProductCompletenessKey, MessageKey> = {
  sourceUrl: "products.field.sourceUrl",
  price: "products.field.price",
  currency: "products.field.currency",
  description: "products.field.description",
  highlights: "products.field.highlights",
  benefits: "products.field.benefits",
  materials: "products.field.materials",
  sizes: "products.field.sizes",
  colors: "products.field.colors",
  variants: "products.field.variants",
  stock: "products.field.stock",
  shipping: "products.field.shipping",
  warranty: "products.field.warranty",
  faq: "products.field.faq",
  allowedClaims: "products.field.allowedClaims",
  forbiddenClaims: "products.field.forbiddenClaims",
  aiNotes: "products.field.aiNotes"
};

function linesToList(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function listToLines(items: string[]): string {
  return items.join("\n");
}

export function ProductForm({ draft, mode, onChange, onSave, onCancel }: Props) {
  const { t } = useAppShell();
  const readOnly = mode === "view";
  const completeness = useMemo(() => computeProductCompleteness(draft), [draft]);
  const titleOk = Boolean(draft.title.trim());
  const priceOk = isValidPriceText(draft.priceText);
  const urlOk = isValidSourceUrl(draft.sourceUrl);
  const canSave = titleOk && priceOk && urlOk && !readOnly;

  const patch = (partial: Partial<ProductDNA>) => onChange({ ...draft, ...partial });

  const title =
    mode === "create"
      ? t("products.createTitle")
      : mode === "edit"
        ? t("products.editTitle")
        : t("products.viewTitle");

  return (
    <div className="panel productFormPanel">
      <div className="panelHead">
        <div>
          <h2 className="headingWithHelp">
            <span>{title}</span>
            <MicroHelp tipId="products.facts" />
          </h2>
          <p>{t("products.createSubtitle")}</p>
        </div>
        <Package />
      </div>

      <div className="productCompleteness" role="status">
        <strong>{t("products.completeness", { percent: completeness.percent })}</strong>
        {completeness.missing.length > 0 ? (
          <p>
            {t("products.missingPrefix")}{" "}
            {completeness.missing
              .slice(0, 6)
              .map((key) => t(MISSING_LABEL[key]))
              .join(", ")}
            {completeness.missing.length > 6 ? "…" : ""}
          </p>
        ) : (
          <p>{t("products.completenessFull")}</p>
        )}
        <p className="productAiRule">{t("products.aiRule")}</p>
      </div>

      <div className="productSections">
        <Section title={t("products.section.basic")} defaultOpen>
          <label>
            {t("products.titleLabel")}
            <input
              value={draft.title}
              readOnly={readOnly}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder={t("products.titlePlaceholder")}
              aria-invalid={!titleOk}
            />
            {!titleOk ? <span className="fieldError">{t("products.error.title")}</span> : null}
          </label>
          <label>
            {t("products.sourceUrlLabel")}
            <input
              value={draft.sourceUrl ?? ""}
              readOnly={readOnly}
              onChange={(e) => patch({ sourceUrl: e.target.value })}
              placeholder={t("products.sourceUrlPlaceholder")}
              aria-invalid={!urlOk}
            />
            {!urlOk ? <span className="fieldError">{t("products.error.sourceUrl")}</span> : null}
          </label>
          <div className="formRow2">
            <label>
              {t("products.priceLabel")}
              <input
                value={draft.priceText ?? ""}
                readOnly={readOnly}
                onChange={(e) => patch({ priceText: e.target.value })}
                placeholder={t("products.pricePlaceholder")}
                aria-invalid={!priceOk}
              />
              {!priceOk ? <span className="fieldError">{t("products.error.price")}</span> : null}
            </label>
            <label>
              {t("products.currencyLabel")}
              <select
                value={draft.currency ?? ""}
                disabled={readOnly}
                onChange={(e) => patch({ currency: e.target.value || undefined })}
              >
                <option value="">{t("products.currencyUnset")}</option>
                <option value="VND">VND</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </label>
          </div>
          <label>
            {t("products.descriptionLabel")}
            <textarea
              rows={3}
              value={draft.description ?? ""}
              readOnly={readOnly}
              onChange={(e) => patch({ description: e.target.value })}
              placeholder={t("products.descriptionPlaceholder")}
            />
          </label>
          <label>
            {t("products.highlightsLabel")}
            <textarea
              rows={3}
              value={listToLines(draft.facts)}
              readOnly={readOnly}
              onChange={(e) => patch({ facts: linesToList(e.target.value) })}
              placeholder={t("products.listPlaceholder")}
            />
          </label>
          <label>
            {t("products.benefitsLabel")}
            <textarea
              rows={3}
              value={listToLines(draft.benefits)}
              readOnly={readOnly}
              onChange={(e) => patch({ benefits: linesToList(e.target.value) })}
              placeholder={t("products.listPlaceholder")}
            />
          </label>
          <label>
            {t("products.materialsLabel")}
            <input
              value={draft.materials ?? ""}
              readOnly={readOnly}
              onChange={(e) => patch({ materials: e.target.value })}
              placeholder={t("products.materialsPlaceholder")}
            />
          </label>
        </Section>

        <Section title={t("products.section.variants")}>
          <label>
            {t("products.sizesLabel")}
            <textarea
              rows={2}
              value={listToLines(draft.sizes)}
              readOnly={readOnly}
              onChange={(e) => patch({ sizes: linesToList(e.target.value) })}
              placeholder={t("products.sizesPlaceholder")}
            />
          </label>
          <label>
            {t("products.colorsLabel")}
            <textarea
              rows={2}
              value={listToLines(draft.colors)}
              readOnly={readOnly}
              onChange={(e) => patch({ colors: linesToList(e.target.value) })}
              placeholder={t("products.colorsPlaceholder")}
            />
          </label>
          <VariantEditor
            variants={draft.variants}
            readOnly={readOnly}
            onChange={(variants) => patch({ variants })}
          />
        </Section>

        <Section title={t("products.section.sales")}>
          <label>
            {t("products.stockLabel")}
            <input
              value={draft.stockText ?? ""}
              readOnly={readOnly}
              onChange={(e) => patch({ stockText: e.target.value })}
              placeholder={t("products.stockPlaceholder")}
            />
          </label>
          <label>
            {t("products.warrantyLabel")}
            <input
              value={draft.warrantyText ?? ""}
              readOnly={readOnly}
              onChange={(e) => patch({ warrantyText: e.target.value })}
              placeholder={t("products.warrantyPlaceholder")}
            />
          </label>
        </Section>

        <Section title={t("products.section.shipping")}>
          <label>
            {t("products.shippingLabel")}
            <textarea
              rows={3}
              value={draft.shippingText ?? ""}
              readOnly={readOnly}
              onChange={(e) => patch({ shippingText: e.target.value })}
              placeholder={t("products.shippingPlaceholder")}
            />
          </label>
        </Section>

        <Section title={t("products.section.faq")}>
          <FaqEditor faq={draft.faq} readOnly={readOnly} onChange={(faq) => patch({ faq })} />
        </Section>

        <Section title={t("products.section.aiSafety")}>
          <label>
            {t("products.allowedClaimsLabel")}
            <textarea
              rows={3}
              value={listToLines(draft.allowedClaims)}
              readOnly={readOnly}
              onChange={(e) => patch({ allowedClaims: linesToList(e.target.value) })}
              placeholder={t("products.listPlaceholder")}
            />
          </label>
          <label>
            {t("products.forbiddenClaimsLabel")}
            <textarea
              rows={3}
              value={listToLines(draft.forbiddenClaims)}
              readOnly={readOnly}
              onChange={(e) => patch({ forbiddenClaims: linesToList(e.target.value) })}
              placeholder={t("products.listPlaceholder")}
            />
          </label>
          <label>
            {t("products.aiNotesLabel")}
            <textarea
              rows={3}
              value={draft.aiNotes ?? ""}
              readOnly={readOnly}
              onChange={(e) => patch({ aiNotes: e.target.value })}
              placeholder={t("products.aiNotesPlaceholder")}
            />
          </label>
        </Section>
      </div>

      <div className="row productFormActions">
        {!readOnly ? (
          <button type="button" className="primary" disabled={!canSave} onClick={onSave}>
            {t("products.save")}
          </button>
        ) : null}
        <button type="button" className="ghost" onClick={onCancel}>
          {t("products.cancel")}
        </button>
      </div>
    </div>
  );
}

function Section({
  title,
  defaultOpen,
  children
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="productSection" open={defaultOpen}>
      <summary>{title}</summary>
      <div className="form productSectionBody">{children}</div>
    </details>
  );
}

function VariantEditor({
  variants,
  readOnly,
  onChange
}: {
  variants: ProductVariant[];
  readOnly: boolean;
  onChange: (next: ProductVariant[]) => void;
}) {
  const { t } = useAppShell();
  const rows = variants.length > 0 ? variants : [{ name: "", values: [] as string[] }];

  return (
    <div className="repeatEditor">
      <div className="repeatEditorHead">
        <strong>{t("products.variantsLabel")}</strong>
        {!readOnly ? (
          <button
            type="button"
            className="ghost compact"
            onClick={() => onChange([...variants, { name: "", values: [] }])}
          >
            <Plus size={14} /> {t("products.addVariant")}
          </button>
        ) : null}
      </div>
      {rows.map((row, index) => (
        <div className="repeatRow" key={`variant-${index}`}>
          <input
            value={row.name}
            readOnly={readOnly}
            placeholder={t("products.variantNamePlaceholder")}
            onChange={(e) => {
              const next = [...rows];
              next[index] = { ...next[index]!, name: e.target.value };
              onChange(next);
            }}
          />
          <input
            value={row.values.join(", ")}
            readOnly={readOnly}
            placeholder={t("products.variantValuesPlaceholder")}
            onChange={(e) => {
              const next = [...rows];
              next[index] = {
                ...next[index]!,
                values: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
              };
              onChange(next);
            }}
          />
          {!readOnly && variants.length > 0 ? (
            <button
              type="button"
              className="ghost compact iconBtn"
              aria-label={t("products.removeRow")}
              onClick={() => onChange(variants.filter((_, i) => i !== index))}
            >
              <Trash2 size={14} />
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function FaqEditor({
  faq,
  readOnly,
  onChange
}: {
  faq: ProductFaq[];
  readOnly: boolean;
  onChange: (next: ProductFaq[]) => void;
}) {
  const { t } = useAppShell();
  const rows = faq.length > 0 ? faq : [{ question: "", answer: "" }];

  return (
    <div className="repeatEditor">
      <div className="repeatEditorHead">
        <strong>{t("products.faqLabel")}</strong>
        {!readOnly ? (
          <button
            type="button"
            className="ghost compact"
            onClick={() => onChange([...faq, { question: "", answer: "" }])}
          >
            <Plus size={14} /> {t("products.addFaq")}
          </button>
        ) : null}
      </div>
      {rows.map((row, index) => (
        <div className="faqRow" key={`faq-${index}`}>
          <input
            value={row.question}
            readOnly={readOnly}
            placeholder={t("products.faqQuestionPlaceholder")}
            onChange={(e) => {
              const next = [...rows];
              next[index] = { ...next[index]!, question: e.target.value };
              onChange(next);
            }}
          />
          <textarea
            rows={2}
            value={row.answer}
            readOnly={readOnly}
            placeholder={t("products.faqAnswerPlaceholder")}
            onChange={(e) => {
              const next = [...rows];
              next[index] = { ...next[index]!, answer: e.target.value };
              onChange(next);
            }}
          />
          {!readOnly && faq.length > 0 ? (
            <button
              type="button"
              className="ghost compact"
              onClick={() => onChange(faq.filter((_, i) => i !== index))}
            >
              {t("products.removeRow")}
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
