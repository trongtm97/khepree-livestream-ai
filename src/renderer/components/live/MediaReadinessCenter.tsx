/**
 * Media Readiness Center — checklist + dry-run without TikTok.
 */
import { useEffect, useState } from "react";
import type {
  MediaDryRunResult,
  MediaMultiDryRunResult,
  MediaReadinessItem,
  MediaReadinessReport,
  MediaReadinessStatus
} from "../../../shared/ipc";
import { useAppShell } from "../../app/AppShellContext";

type Props = {
  accountId: string;
};

function statusClass(status: MediaReadinessStatus): string {
  if (status === "READY") return "ready";
  if (status === "NEEDS_SETUP") return "warn";
  if (status === "ERROR") return "blocked";
  return "optional";
}

export function MediaReadinessCenter({ accountId }: Props) {
  const { t, loading, run, notify } = useAppShell();
  const [report, setReport] = useState<MediaReadinessReport | null>(null);
  const [dryRun, setDryRun] = useState<MediaDryRunResult | null>(null);
  const [multi, setMulti] = useState<MediaMultiDryRunResult | null>(null);

  const loadReport = () =>
    run(async () => {
      const next = await window.khepreeLivestreamAI.getMediaReadiness(accountId);
      setReport(next);
    });

  useEffect(() => {
    void loadReport();
  }, [accountId]);

  const itemLabel = (id: MediaReadinessItem["id"]) => t(`mediaReady.item.${id}`);
  const statusLabel = (status: MediaReadinessStatus) => t(`mediaReady.status.${status}`);

  const runDry = () =>
    run(async () => {
      const result = await window.khepreeLivestreamAI.runMediaDryRun(accountId);
      setDryRun(result);
      notify({
        tone: result.error ? "error" : "success",
        title: result.error ? t("mediaReady.dryRun.fail") : t("mediaReady.dryRun.ok")
      });
      await loadReport();
    });

  const runMulti = () =>
    run(async () => {
      const result = await window.khepreeLivestreamAI.runMediaMultiDryRun();
      setMulti(result);
      notify({
        tone: result.isolationOk ? "success" : "warning",
        title: result.isolationOk
          ? t("mediaReady.multi.ok")
          : t("mediaReady.multi.warn")
      });
    });

  return (
    <section className="panel mediaReadinessCenter">
      <div className="panelHead">
        <div>
          <h2>{t("mediaReady.title")}</h2>
          <p className="settingsHint">{t("mediaReady.hint")}</p>
        </div>
        <button type="button" className="ghost" disabled={loading} onClick={() => void loadReport()}>
          {t("mediaReady.refresh")}
        </button>
      </div>

      {report ? (
        <>
          <p className={`mediaReadyOverall ${report.readyForMode ? "ready" : "warn"}`}>
            {report.readyForMode
              ? t("mediaReady.overall.ready", {
                  mode: t(`voice.outputMode.${report.outputMode}`)
                })
              : t("mediaReady.overall.blocked", {
                  mode: t(`voice.outputMode.${report.outputMode}`),
                  count: report.blockingIds.length
                })}
          </p>
          <ul className="mediaReadyList">
            {report.items.map((item) => (
              <li key={item.id} className={`mediaReadyItem ${statusClass(item.status)}`}>
                <div>
                  <strong>{itemLabel(item.id)}</strong>
                  <span className="mediaReadyStatus">{statusLabel(item.status)}</span>
                </div>
                {item.detail ? <p className="settingsHint">{item.detail}</p> : null}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="tiktokHint">{t("mediaReady.loading")}</p>
      )}

      <div className="rowActions mediaReadyActions">
        <button type="button" className="primary" disabled={loading} onClick={() => void runDry()}>
          {t("mediaReady.dryRun")}
        </button>
        <button type="button" className="ghost" disabled={loading} onClick={() => void runMulti()}>
          {t("mediaReady.multi")}
        </button>
      </div>
      <p className="settingsHint">{t("mediaReady.dryRun.hint")}</p>

      {dryRun ? (
        <div className="mediaReadyResult">
          <p>
            <strong>{t("mediaReady.dryRun.phrase")}:</strong> {dryRun.phrase}
          </p>
          <p>
            {t("mediaReady.dryRun.audio")}:{" "}
            {dryRun.audioPlayed ? t("mediaReady.yes") : t("mediaReady.no")}
            {" · "}
            {t("mediaReady.dryRun.scene")}:{" "}
            {dryRun.scenePreviewOk ? t("mediaReady.yes") : t("mediaReady.no")}
          </p>
          {dryRun.error ? <p className="settingsHint warn">{dryRun.error}</p> : null}
        </div>
      ) : null}

      {multi ? (
        <div className="mediaReadyResult">
          <p>
            <strong>{t("mediaReady.multi.title")}</strong> —{" "}
            {multi.isolationOk ? t("mediaReady.multi.isolated") : t("mediaReady.multi.mixed")}
          </p>
          <ul className="mediaReadyMultiList">
            {multi.results.map((r) => (
              <li key={r.accountId}>
                <code>{r.token}</code>
                <span>{r.phrase}</span>
              </li>
            ))}
          </ul>
          <p className="settingsHint">{t("mediaReady.multi.verify")}</p>
        </div>
      ) : null}
    </section>
  );
}
