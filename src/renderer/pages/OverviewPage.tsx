import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import type { AppSnapshot } from "../../shared/ipc";
import type { LiveStartReadyBatchResult } from "../../shared/live-batch";
import { LIVE_BATCH_REASONS } from "../../shared/live-batch";
import { useAppShell } from "../app/AppShellContext";
import { AccountLiveCard } from "../components/live-center/AccountLiveCard";
import { AddAccountWizard } from "../components/live-center/AddAccountWizard";
import { LiveCenterMetrics } from "../components/live-center/LiveCenterMetrics";
import { OperatorQueue, countOperatorTodos } from "../components/live-center/OperatorQueue";

function countSkipped(result: LiveStartReadyBatchResult, reason: string): number {
  return result.skipped.filter((s) => s.reasonCode === reason).length;
}

export function OverviewPage({ snapshot }: { snapshot: AppSnapshot }) {
  const { t, run, refresh, notify, setTab } = useAppShell();
  const [wizardOpen, setWizardOpen] = useState(false);
  const todoCount = useMemo(() => countOperatorTodos(snapshot), [snapshot]);

  const openAccount = (accountId: string) =>
    run(async () => {
      await window.khepreeLivestreamAI.setFocusedAccount(accountId);
      setTab("live");
      await refresh();
    });

  const startOne = (accountId: string) =>
    run(async () => {
      await window.khepreeLivestreamAI.startLive(accountId);
      notify({ tone: "success", title: t("liveCenter.toast.started") });
      await refresh();
    });

  const stopOne = (accountId: string) =>
    run(async () => {
      await window.khepreeLivestreamAI.stopLive(accountId);
      notify({ tone: "info", title: t("liveCenter.toast.stopped") });
      await refresh();
    });

  const startReady = () =>
    run(async () => {
      const result = await window.khepreeLivestreamAI.startReadyLives();
      const parts: string[] = [
        t("liveCenter.runAll.result.started", { count: result.started.length })
      ];
      const already = countSkipped(result, LIVE_BATCH_REASONS.ALREADY_RUNNING);
      const noProduct = countSkipped(result, LIVE_BATCH_REASONS.NO_PRODUCT);
      const noTiktok = countSkipped(result, LIVE_BATCH_REASONS.TIKTOK_DISCONNECTED);
      const limit = countSkipped(result, LIVE_BATCH_REASONS.CAPACITY_LIMIT);
      if (already > 0) {
        parts.push(t("liveCenter.runAll.result.alreadyRunning", { count: already }));
      }
      if (noProduct > 0) {
        parts.push(t("liveCenter.runAll.result.noProduct", { count: noProduct }));
      }
      if (noTiktok > 0) {
        parts.push(t("liveCenter.runAll.result.noTiktok", { count: noTiktok }));
      }
      if (limit > 0) {
        parts.push(t("liveCenter.runAll.result.limit", { count: limit }));
      }
      if (result.failed.length > 0) {
        parts.push(t("liveCenter.runAll.result.failed", { count: result.failed.length }));
      }
      notify({
        tone: result.started.length > 0 ? "success" : "warning",
        title: t("liveCenter.runAll.done"),
        message: parts.join(" · ")
      });
      await refresh();
    });

  const stopAll = () =>
    run(async () => {
      const result = await window.khepreeLivestreamAI.stopAllLives();
      notify({
        tone: "info",
        title: t("liveCenter.stopAll.done"),
        message: t("liveCenter.stopAll.note", { count: result.stopped.length })
      });
      await refresh();
    });

  return (
    <section className="liveCenterPage">
      <LiveCenterMetrics snapshot={snapshot} todoCount={todoCount} />

      <div className="liveCenterToolbar row">
        <button type="button" className="primary" onClick={() => void startReady()}>
          {t("liveCenter.runAll")}
        </button>
        <button type="button" className="ghost" onClick={() => void stopAll()}>
          {t("liveCenter.stopAll")}
        </button>
        <button
          type="button"
          className="danger"
          onClick={() =>
            void run(async () => {
              await window.khepreeLivestreamAI.emergencyStopAllAi();
              notify({ tone: "error", title: t("operator.emergency.done") });
              await refresh();
            })
          }
        >
          {t("operator.emergency")}
        </button>
        <button type="button" className="ghost" onClick={() => setWizardOpen(true)}>
          <Plus size={16} /> {t("liveCenter.addAccount")}
        </button>
      </div>

      {snapshot.lives.length === 0 ? (
        <div className="panel">
          <p className="tiktokHint" role="status">
            {t("liveCenter.empty")}
          </p>
          <button type="button" className="primary" onClick={() => setWizardOpen(true)}>
            <Plus size={16} /> {t("liveCenter.addAccount")}
          </button>
        </div>
      ) : (
        <div className="accountLiveGrid">
          {snapshot.lives.map((live) => (
            <AccountLiveCard
              key={live.accountId}
              live={live}
              products={snapshot.products}
              onOpen={() => void openAccount(live.accountId)}
              onStart={() => void startOne(live.accountId)}
              onStop={() => void stopOne(live.accountId)}
            />
          ))}
        </div>
      )}

      <OperatorQueue snapshot={snapshot} />

      <AddAccountWizard
        snapshot={snapshot}
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
      />
    </section>
  );
}
