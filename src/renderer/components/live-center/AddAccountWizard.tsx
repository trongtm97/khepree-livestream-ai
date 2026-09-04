import { useState } from "react";
import type { AppSnapshot } from "../../../shared/ipc";
import { useAppShell } from "../../app/AppShellContext";

type Step = 1 | 2 | 3 | 4 | 5 | 6;

export function AddAccountWizard({
  snapshot,
  open,
  onClose
}: {
  snapshot: AppSnapshot;
  open: boolean;
  onClose: () => void;
}) {
  const { t, run, refresh, notify, setTab } = useAppShell();
  const [step, setStep] = useState<Step>(1);
  const [label, setLabel] = useState("");
  const [username, setUsername] = useState("");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [productId, setProductId] = useState("");

  if (!open) return null;

  const reset = () => {
    setStep(1);
    setLabel("");
    setUsername("");
    setAccountId(null);
    setProductId("");
  };

  const close = () => {
    reset();
    onClose();
  };

  const create = () =>
    run(async () => {
      const created = await window.khepreeLivestreamAI.createTikTokAccount({
        username: username.trim().replace(/^@/, ""),
        label: label.trim() || undefined
      });
      setAccountId(created.id);
      await window.khepreeLivestreamAI.setFocusedAccount(created.id);
      notify({ tone: "success", title: t("liveCenter.wizard.created") });
      setStep(4);
      await refresh();
    });

  const connectTikTok = () => {
    if (!accountId) return;
    void run(async () => {
      await window.khepreeLivestreamAI.connectTikTok(accountId);
      notify({ tone: "success", title: t("liveCenter.wizard.tiktokConnecting") });
      await refresh();
    });
  };

  const openLiveManager = () => {
    if (!accountId) return;
    void run(async () => {
      await window.khepreeLivestreamAI.openLiveManager(accountId);
      notify({ tone: "info", title: t("liveCenter.wizard.liveManagerOpened") });
      await refresh();
    });
  };

  const saveProduct = () => {
    if (!accountId || !productId) return;
    void run(async () => {
      await window.khepreeLivestreamAI.setCurrentProduct(accountId, productId);
      notify({ tone: "success", title: t("liveCenter.wizard.productSaved") });
      setStep(6);
      await refresh();
    });
  };

  return (
    <div className="wizardOverlay" role="dialog" aria-modal="true" aria-labelledby="add-tt-title">
      <div className="wizardCard">
        <div className="panelHead">
          <div>
            <h2 id="add-tt-title">{t("liveCenter.wizard.title")}</h2>
            <p>{t("liveCenter.wizard.step", { n: step, total: 6 })}</p>
          </div>
          <button type="button" className="ghost small" onClick={close}>
            {t("liveCenter.wizard.close")}
          </button>
        </div>

        {step === 1 ? (
          <div className="wizardBody">
            <label>
              {t("liveCenter.wizard.label")}
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={t("liveCenter.wizard.labelPh")}
                autoFocus
              />
            </label>
            <p className="tiktokHint">{t("liveCenter.wizard.noPassword")}</p>
            <div className="row">
              <button type="button" className="primary" disabled={!label.trim()} onClick={() => setStep(2)}>
                {t("liveCenter.wizard.next")}
              </button>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="wizardBody">
            <label>
              {t("liveCenter.wizard.username")}
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t("liveCenter.wizard.usernamePh")}
                autoFocus
              />
            </label>
            <div className="row">
              <button type="button" className="ghost" onClick={() => setStep(1)}>
                {t("liveCenter.wizard.back")}
              </button>
              <button
                type="button"
                className="primary"
                disabled={!username.trim()}
                onClick={() => setStep(3)}
              >
                {t("liveCenter.wizard.next")}
              </button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="wizardBody">
            <p>
              {t("liveCenter.wizard.confirm", {
                label: label.trim(),
                username: username.trim().replace(/^@/, "")
              })}
            </p>
            <div className="row">
              <button type="button" className="ghost" onClick={() => setStep(2)}>
                {t("liveCenter.wizard.back")}
              </button>
              <button type="button" className="primary" onClick={() => void create()}>
                {t("liveCenter.wizard.create")}
              </button>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="wizardBody">
            <p>{t("liveCenter.wizard.connectBody")}</p>
            <div className="row">
              <button type="button" className="primary" onClick={connectTikTok}>
                {t("liveCenter.wizard.connectTikTok")}
              </button>
              <button type="button" className="ghost" onClick={openLiveManager}>
                {t("liveCenter.wizard.openLiveManager")}
              </button>
            </div>
            <div className="row">
              <button type="button" className="ghost" onClick={() => setStep(5)}>
                {t("liveCenter.wizard.skipLater")}
              </button>
              <button type="button" className="primary" onClick={() => setStep(5)}>
                {t("liveCenter.wizard.next")}
              </button>
            </div>
          </div>
        ) : null}

        {step === 5 ? (
          <div className="wizardBody">
            <label>
              {t("liveCenter.wizard.product")}
              <select value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">{t("liveCenter.wizard.productNone")}</option>
                {snapshot.products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
            {snapshot.products.length === 0 ? (
              <p className="tiktokHint">{t("liveCenter.wizard.noProducts")}</p>
            ) : null}
            <div className="row">
              <button type="button" className="ghost" onClick={() => setStep(4)}>
                {t("liveCenter.wizard.back")}
              </button>
              <button type="button" className="ghost" onClick={() => setStep(6)}>
                {t("liveCenter.wizard.skipLater")}
              </button>
              <button
                type="button"
                className="primary"
                disabled={!productId}
                onClick={() => void saveProduct()}
              >
                {t("liveCenter.wizard.saveProduct")}
              </button>
            </div>
          </div>
        ) : null}

        {step === 6 ? (
          <div className="wizardBody">
            <p>{t("liveCenter.wizard.doneBody")}</p>
            <div className="row">
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setTab("connections");
                  close();
                }}
              >
                {t("liveCenter.wizard.goConnections")}
              </button>
              <button type="button" className="primary" onClick={close}>
                {t("liveCenter.wizard.finish")}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
