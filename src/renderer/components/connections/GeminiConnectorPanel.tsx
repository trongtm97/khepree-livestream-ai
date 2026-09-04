import { useState } from "react";
import { Bot } from "lucide-react";
import type { GeminiConnectionPhase, GeminiPublicState } from "../../../shared/gemini-contracts";
import { useAppShell } from "../../app/AppShellContext";
import type { MessageKey } from "../../i18n/types";
import { GeminiOnboardingWizard } from "./GeminiOnboardingWizard";

const PHASE_LABEL: Record<GeminiConnectionPhase, MessageKey> = {
  READY: "gemini.phase.READY",
  NOT_SIGNED_IN: "gemini.phase.NOT_SIGNED_IN",
  REAUTH_REQUIRED: "gemini.phase.REAUTH_REQUIRED",
  SLOW: "gemini.phase.SLOW",
  QUOTA_EXCEEDED: "gemini.phase.QUOTA_EXCEEDED",
  CONNECTOR_ERROR: "gemini.phase.CONNECTOR_ERROR",
  DISCONNECTED: "gemini.phase.DISCONNECTED",
  DEMO: "gemini.phase.DEMO",
  STARTING: "gemini.phase.STARTING",
  CIRCUIT_OPEN: "gemini.phase.CIRCUIT_OPEN",
  FALLBACK_SCRIPT: "gemini.phase.FALLBACK_SCRIPT"
};

export function GeminiConnectorPanel({
  gemini,
  startWizard = false
}: {
  gemini: GeminiPublicState;
  startWizard?: boolean;
}) {
  const { t, run, refresh, notify } = useAppShell();
  const connected = gemini.phase === "READY" || gemini.phase === "SLOW";
  const [wizard, setWizard] = useState(startWizard || !connected);

  const reauth = () =>
    run(async () => {
      await window.khepreeLivestreamAI.reauthGemini();
      notify({ tone: "success", title: t("gemini.toast.reauth") });
      await refresh();
    });

  const disconnect = () =>
    run(async () => {
      await window.khepreeLivestreamAI.disconnectGemini();
      notify({ tone: "info", title: t("gemini.toast.disconnected") });
      setWizard(true);
      await refresh();
    });

  const useDemo = () => {
    if (!window.confirm(t("gemini.demoConfirm"))) return;
    void run(async () => {
      await window.khepreeLivestreamAI.acknowledgeLlmDemo();
      notify({ tone: "warning", title: t("gemini.toast.demo") });
      await refresh();
    });
  };

  const onModel = (model: string) =>
    run(async () => {
      await window.khepreeLivestreamAI.setGeminiModel(model);
      notify({ tone: "success", title: t("gemini.toast.modelSaved") });
      await refresh();
    });

  return (
    <div className="panel">
      <div className="panelHead">
        <div>
          <h2>{t("setup.geminiTitle")}</h2>
          <p>{t("setup.geminiSubtitle")}</p>
        </div>
        <Bot />
      </div>

      {wizard ? (
        <GeminiOnboardingWizard
          gemini={gemini}
          onDone={() => {
            setWizard(false);
            void refresh();
          }}
          onCancel={connected ? () => setWizard(false) : undefined}
        />
      ) : (
        <>
          <div className={`statusBox geminiStatusBox phase-${gemini.phase}`}>
            <strong>{t(PHASE_LABEL[gemini.phase])}</strong>
            <span>
              {gemini.usingFallbackScript || gemini.phase === "FALLBACK_SCRIPT"
                ? t("gemini.fallbackBanner")
                : connected
                  ? t("gemini.connectedHint", { model: gemini.model || "—" })
                  : gemini.message || t("gemini.noMessage")}
            </span>
          </div>

          <dl className="geminiMeta">
            <div>
              <dt>{t("gemini.meta.account")}</dt>
              <dd>{t(`gemini.account.${gemini.account}` as MessageKey)}</dd>
            </div>
            <div>
              <dt>{t("gemini.meta.latency")}</dt>
              <dd>
                {gemini.latencyMs != null
                  ? t("gemini.latencyMs", { ms: gemini.latencyMs })
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>{t("gemini.meta.checked")}</dt>
              <dd>
                {gemini.lastCheckedAt
                  ? new Date(gemini.lastCheckedAt).toLocaleString()
                  : "—"}
              </dd>
            </div>
          </dl>

          <label className="geminiModelLabel">
            {t("gemini.model")}
            <select
              value={gemini.model ?? ""}
              disabled={gemini.models.length === 0}
              onChange={(e) => void onModel(e.target.value)}
            >
              {gemini.models.length === 0 ? (
                <option value="">{t("gemini.modelEmpty")}</option>
              ) : (
                gemini.models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))
              )}
            </select>
          </label>

          <div className="row productListToolbar geminiActions">
            <button type="button" className="primary" onClick={() => setWizard(true)}>
              {t("gemini.setupAgain")}
            </button>
            <button type="button" className="ghost" onClick={() => void reauth()}>
              {t("gemini.reauth")}
            </button>
            <button
              type="button"
              className="ghost"
              disabled={gemini.worker === "STOPPED"}
              onClick={() => void disconnect()}
            >
              {t("gemini.disconnect")}
            </button>
            {gemini.phase !== "DEMO" ? (
              <button type="button" className="ghost" onClick={useDemo}>
                {t("gemini.useDemo")}
              </button>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
