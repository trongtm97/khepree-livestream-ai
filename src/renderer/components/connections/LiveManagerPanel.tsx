import { MonitorPlay } from "lucide-react";
import type {
  LiveManagerPhase,
  LiveManagerPublicState
} from "../../../shared/live-manager-contracts";
import { useAppShell } from "../../app/AppShellContext";
import type { MessageKey } from "../../i18n/types";

const PHASE_LABEL: Record<LiveManagerPhase, MessageKey> = {
  CLOSED: "liveManager.phase.CLOSED",
  OPENING: "liveManager.phase.OPENING",
  WAITING_LOGIN: "liveManager.phase.WAITING_LOGIN",
  SIGNED_IN: "liveManager.phase.SIGNED_IN",
  READY: "liveManager.phase.READY",
  ERROR: "liveManager.phase.ERROR"
};

export function LiveManagerPanel({ liveManager }: { liveManager: LiveManagerPublicState }) {
  const { t, run, refresh, notify } = useAppShell();
  const open = liveManager.phase !== "CLOSED";
  const busy = liveManager.phase === "OPENING";

  const openBrowser = () =>
    run(async () => {
      await window.khepreeLivestreamAI.openLiveManager();
      notify({ tone: "success", title: t("liveManager.toast.opened") });
      await refresh();
    });

  const closeBrowser = () =>
    run(async () => {
      await window.khepreeLivestreamAI.closeLiveManager();
      notify({ tone: "info", title: t("liveManager.toast.closed") });
      await refresh();
    });

  const refreshStatus = () =>
    run(async () => {
      await window.khepreeLivestreamAI.refreshLiveManager();
      await refresh();
    });

  const captureDiag = () =>
    run(async () => {
      await window.khepreeLivestreamAI.captureLiveManagerDiagnostic();
      notify({ tone: "info", title: t("liveManager.toast.diagnostic") });
      await refresh();
    });

  return (
    <div className="panel">
      <div className="panelHead">
        <div>
          <h2>{t("liveManager.title")}</h2>
          <p>{t("liveManager.subtitle")}</p>
        </div>
        <MonitorPlay />
      </div>

      <div className={`statusBox tiktokStatusBox phase-${liveManager.phase}`}>
        <strong>{t(PHASE_LABEL[liveManager.phase])}</strong>
        <span>{liveManager.message || t("liveManager.noMessage")}</span>
      </div>

      {(liveManager.phase === "READY" || liveManager.phase === "SIGNED_IN") &&
      liveManager.selectorPackEmpty ? (
        <p className="tiktokHint" role="status">
          {t("liveManager.emptyPack")}
        </p>
      ) : null}

      {liveManager.lastDiagnosticScreenshot ? (
        <p className="tiktokHint">
          {t("liveManager.diagnosticPath", { path: liveManager.lastDiagnosticScreenshot })}
        </p>
      ) : null}

      <div className="row">
        {open ? (
          <>
            <button type="button" className="ghost" disabled={busy} onClick={() => void refreshStatus()}>
              {t("liveManager.refresh")}
            </button>
            <button type="button" className="ghost" disabled={busy} onClick={() => void captureDiag()}>
              {t("liveManager.diagnostic")}
            </button>
            <button type="button" className="ghost" disabled={busy} onClick={() => void closeBrowser()}>
              {t("liveManager.close")}
            </button>
          </>
        ) : (
          <button type="button" className="primary" disabled={busy} onClick={() => void openBrowser()}>
            {t("liveManager.open")}
          </button>
        )}
      </div>

      <p className="tiktokHint">{t("liveManager.privacyHint")}</p>
    </div>
  );
}
