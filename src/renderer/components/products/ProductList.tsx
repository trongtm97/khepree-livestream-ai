import { CircleDollarSign, Copy, Eye, Pencil, Radio, Trash2 } from "lucide-react";
import type { ProductDNA } from "../../../shared/live-types";
import { computeProductCompleteness } from "../../../shared/product-dna";
import { useAppShell } from "../../app/AppShellContext";
import { EmptyState } from "../common/EmptyState";

type Props = {
  products: ProductDNA[];
  currentProductId?: string;
  onCreate: () => void;
  onImport: () => void;
  onView: (product: ProductDNA) => void;
  onEdit: (product: ProductDNA) => void;
  onDuplicate: (product: ProductDNA) => void;
  onDelete: (product: ProductDNA) => void;
  onSelectLive: (product: ProductDNA) => void;
};

export function ProductList({
  products,
  currentProductId,
  onCreate,
  onImport,
  onView,
  onEdit,
  onDuplicate,
  onDelete,
  onSelectLive
}: Props) {
  const { t } = useAppShell();

  return (
    <div className="panel">
      <div className="panelHead">
        <div>
          <h2>{t("products.listTitle")}</h2>
          <p>{t("products.listSubtitle")}</p>
        </div>
        <CircleDollarSign />
      </div>

      <div className="row productListToolbar">
        <button type="button" className="primary" onClick={onCreate}>
          {t("products.addNew")}
        </button>
        <button type="button" className="ghost" onClick={onImport}>
          {t("import.open")}
        </button>
      </div>

      <div className="queue">
        {products.length === 0 ? (
          <EmptyState text={t("products.empty")} />
        ) : (
          products.map((p) => {
            const completeness = computeProductCompleteness(p);
            const isLive = currentProductId === p.id;
            return (
              <article className={`productCard ${isLive ? "isLive" : ""}`} key={p.id}>
                <div className="productCardMain">
                  <div>
                    <strong>{p.title}</strong>
                    <span className="productMeta">
                      {p.priceText
                        ? `${p.priceText}${p.currency ? ` ${p.currency}` : ""}`
                        : t("products.noPrice")}
                    </span>
                  </div>
                  <div className="productBadges">
                    <span className="completenessPill">
                      {t("products.completenessShort", { percent: completeness.percent })}
                    </span>
                    {isLive ? <span className="livePill">{t("products.liveBadge")}</span> : null}
                  </div>
                </div>
                <div className="productActions">
                  <button type="button" className="ghost compact" onClick={() => onView(p)}>
                    <Eye size={14} /> {t("products.view")}
                  </button>
                  <button type="button" className="ghost compact" onClick={() => onEdit(p)}>
                    <Pencil size={14} /> {t("products.edit")}
                  </button>
                  <button type="button" className="ghost compact" onClick={() => onDuplicate(p)}>
                    <Copy size={14} /> {t("products.duplicate")}
                  </button>
                  <button
                    type="button"
                    className="ghost compact"
                    disabled={isLive}
                    onClick={() => onSelectLive(p)}
                  >
                    <Radio size={14} /> {t("products.selectLive")}
                  </button>
                  <button type="button" className="ghost compact danger" onClick={() => onDelete(p)}>
                    <Trash2 size={14} /> {t("products.delete")}
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
