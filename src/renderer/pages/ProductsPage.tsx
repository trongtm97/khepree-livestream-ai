import { useState } from "react";
import type { AppSnapshot } from "../../shared/ipc";
import type { ProductDNA } from "../../shared/live-types";
import type { ImportPreviewRow } from "../../shared/product-import";
import {
  duplicateProduct,
  emptyProductDraft,
  normalizeProduct,
  validateProduct
} from "../../shared/product-dna";
import { useAppShell } from "../app/AppShellContext";
import { ProductForm, type ProductFormMode } from "../components/products/ProductForm";
import {
  applyEditedImportRow,
  ProductImportPanel
} from "../components/products/ProductImportPanel";
import { ProductList } from "../components/products/ProductList";

type Panel = "form" | null;

export function ProductsPage({ snapshot }: { snapshot: AppSnapshot }) {
  const { t, run, notify, refresh } = useAppShell();
  const [panel, setPanel] = useState<Panel>(null);
  const [mode, setMode] = useState<ProductFormMode>("create");
  const [draft, setDraft] = useState<ProductDNA>(() => emptyProductDraft());
  const [importRows, setImportRows] = useState<ImportPreviewRow[]>([]);
  const [editingImportKey, setEditingImportKey] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);

  const closeForm = () => {
    setPanel(null);
    setEditingImportKey(null);
    setDraft(emptyProductDraft());
  };

  const openCreate = () => {
    setShowImport(false);
    setEditingImportKey(null);
    setDraft(emptyProductDraft());
    setMode("create");
    setPanel("form");
  };

  const openImport = () => {
    setPanel(null);
    setEditingImportKey(null);
    setShowImport(true);
  };

  const openView = (product: ProductDNA) => {
    setShowImport(false);
    setEditingImportKey(null);
    setDraft(normalizeProduct(product));
    setMode("view");
    setPanel("form");
  };

  const openEdit = (product: ProductDNA) => {
    setShowImport(false);
    setEditingImportKey(null);
    setDraft(normalizeProduct(product));
    setMode("edit");
    setPanel("form");
  };

  const openImportEdit = (row: ImportPreviewRow) => {
    setDraft(normalizeProduct(row.product));
    setMode("edit");
    setEditingImportKey(row.key);
    setPanel("form");
    setShowImport(true);
  };

  const save = () =>
    run(async () => {
      const next = normalizeProduct({
        ...draft,
        updatedAt: new Date().toISOString()
      });
      const validation = validateProduct(next);
      if (!validation.ok) {
        throw new Error(
          validation.errors.title
            ?? validation.errors.priceText
            ?? validation.errors.sourceUrl
            ?? "PRODUCT_INVALID"
        );
      }

      if (editingImportKey) {
        setImportRows((prev) => applyEditedImportRow(prev, editingImportKey, next));
        notify({ tone: "success", title: t("import.rowUpdated") });
        setEditingImportKey(null);
        setPanel(null);
        return;
      }

      await window.khepreeLivestreamAI.saveProduct(next);
      notify({
        tone: "success",
        title: mode === "edit" ? t("products.toast.updated") : t("products.toast.saved")
      });
      closeForm();
      await refresh();
    });

  const duplicate = (product: ProductDNA) =>
    run(async () => {
      const copy = duplicateProduct(product);
      await window.khepreeLivestreamAI.saveProduct(copy);
      notify({ tone: "success", title: t("products.toast.duplicated") });
      await refresh();
      openEdit(copy);
    });

  const remove = (product: ProductDNA) => {
    if (!window.confirm(t("products.deleteConfirm", { title: product.title }))) return;
    void run(async () => {
      await window.khepreeLivestreamAI.deleteProduct(product.id);
      notify({ tone: "success", title: t("products.toast.deleted") });
      if (draft.id === product.id) closeForm();
      await refresh();
    });
  };

  const selectLive = (product: ProductDNA) =>
    run(async () => {
      await window.khepreeLivestreamAI.selectProduct(product.id);
      notify({ tone: "success", title: t("products.toast.selected", { title: product.title }) });
      await refresh();
    });

  return (
    <section className="twoCol productsPage">
      <ProductList
        products={snapshot.products}
        currentProductId={snapshot.currentProductId}
        onCreate={openCreate}
        onImport={openImport}
        onView={openView}
        onEdit={openEdit}
        onDuplicate={(p) => void duplicate(p)}
        onDelete={remove}
        onSelectLive={(p) => void selectLive(p)}
      />
      {panel === "form" ? (
        <ProductForm
          draft={draft}
          mode={mode}
          onChange={setDraft}
          onSave={() => void save()}
          onCancel={() => {
            if (editingImportKey) {
              setEditingImportKey(null);
              setPanel(null);
              return;
            }
            closeForm();
          }}
        />
      ) : showImport ? (
        <ProductImportPanel
          existing={snapshot.products}
          rows={importRows}
          onRowsChange={setImportRows}
          onEditRow={openImportEdit}
          onClose={() => {
            setShowImport(false);
            setImportRows([]);
          }}
          onImported={refresh}
        />
      ) : (
        <aside className="panel productFormPlaceholder">
          <h2>{t("products.placeholderTitle")}</h2>
          <p>{t("products.placeholderBody")}</p>
          <div className="row productListToolbar">
            <button type="button" className="primary" onClick={openCreate}>
              {t("products.addNew")}
            </button>
            <button type="button" className="ghost" onClick={openImport}>
              {t("import.open")}
            </button>
          </div>
        </aside>
      )}
    </section>
  );
}
