import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import type { AppSnapshot } from "../../shared/ipc";
import { useAppShell } from "../app/AppShellContext";
import { accountStartBlock } from "../app/account-start-gate";
import { AccountLiveCard } from "../components/live-center/AccountLiveCard";
import { AddAccountWizard } from "../components/live-center/AddAccountWizard";
import { LiveCenterMetrics } from "../components/live-center/LiveCenterMetrics";
import { OperatorQueue, countOperatorTodos } from "../components/live-center/OperatorQueue";

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
      let started = 0;
      let skipProduct = 0;
      let skipTiktok = 0;
      let skipLimit = 0;
      let running = snapshot.lives.filter((l) => l.isRunning).length;
      const max = snapshot.maxConcurrentLives ?? 5;

      for (const live of snapshot.lives) {
        if (live.isRunning) continue;
        const block = accountStartBlock(live);
        if (block === "no_product") {
          skipProduct += 1;
          continue;
        }
        if (block === "tiktok_disconnected") {
          skipTiktok += 1;
          continue;
        }
        if (running >= max) {
          skipLimit += 1;
          continue;
        }
        await window.khepreeLivestreamAI.startLive(live.accountId);
        started += 1;
        running += 1;
      }

      const parts = [t("liveCenter.runAll.result.started", { count: started })];
      if (skipProduct > 0) {
        parts.push(t("liveCenter.runAll.result.noProduct", { count: skipProduct }));
      }
      if (skipTiktok > 0) {
        parts.push(t("liveCenter.runAll.result.noTiktok", { count: skipTiktok }));
      }
      if (skipLimit > 0) {
        parts.push(t("liveCenter.runAll.result.limit", { count: skipLimit }));
      }
      notify({
        tone: started > 0 ? "success" : "warning",
        title: t("liveCenter.runAll.done"),
        message: parts.join(" · ")
      });
      await refresh();
    });

  const stopAll = () =>
    run(async () => {
      const running = snapshot.lives.filter((l) => l.isRunning);
      for (const live of running) {
        await window.khepreeLivestreamAI.stopLive(live.accountId);
      }
      notify({
        tone: "info",
        title: t("liveCenter.stopAll.done"),
        message: t("liveCenter.stopAll.note", { count: running.length })
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
