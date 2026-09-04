import { useEffect } from "react";
import { Hand, MicOff, RotateCcw, Siren } from "lucide-react";
import type { AppSnapshot } from "../../../shared/ipc";
import type { AutomationMode } from "../../../shared/live-types";
import { requireFocusedAccountId } from "../../app/accountId";
import { useAppShell } from "../../app/AppShellContext";
import { buildReadiness } from "../../app/readiness";
import { labelAutomationMode, labelLiveState } from "../../i18n";
import { MicroHelp } from "../help/MicroHelp";

const MODES: AutomationMode[] = [
  "MANUAL_ASSIST",
  "ASSISTED",
  "SUPERVISED_AUTO",
  "FULL_AUTO"
];

const MODE_TIP: Partial<Record<AutomationMode, string>> = {
  MANUAL_ASSIST: "mode.manual_assist",
  SUPERVISED_AUTO: "mode.supervised_auto"
};

export function LiveControls({ snapshot }: { snapshot: AppSnapshot }) {
  const { t, run, setTab, refresh, notify } = useAppShell();
  const modeTipId = MODE_TIP[snapshot.automationMode] ?? "mode.supervised_auto";
  const readiness = buildReadiness(snapshot, t);
  const blocked = !snapshot.liveRunning && !readiness.canStartLive;
  const blocking = readiness.items.filter((x) => x.severity === "BLOCKING" && !x.ready);
  const accountId = snapshot.focusedAccountId;
  const live = snapshot.lives.find((l) => l.accountId === accountId);
  const operatorMode =
    live?.operatorMode ??
    (accountId ? snapshot.operatorControl?.byAccount[accountId]?.mode : undefined) ??
    "AI_ACTIVE";
  const inTakeover = operatorMode === "HUMAN_TAKEOVER";
  const emergency = Boolean(snapshot.operatorControl?.emergencyStop);
  const hotkey = snapshot.operatorControl?.takeoverHotkey ?? "F8";

  const takeover = () =>
    run(async () => {
      const id = requireFocusedAccountId(snapshot);
      await window.khepreeLivestreamAI.enterTakeover(id);
      notify({ tone: "info", title: t("operator.takeover.on") });
      await refresh();
    });

  const exitTakeover = () =>
    run(async () => {
      const id = requireFocusedAccountId(snapshot);
      await window.khepreeLivestreamAI.exitTakeover(id);
      notify({ tone: "success", title: t("operator.takeover.off") });
      await refresh();
    });

  const emergencyStop = () =>
    run(async () => {
      await window.khepreeLivestreamAI.emergencyStopAllAi();
      notify({ tone: "error", title: t("operator.emergency.done") });
      await refresh();
    });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      if (e.key.toUpperCase() !== hotkey.toUpperCase()) return;
      if (!accountId?.trim()) return;
      e.preventDefault();
      void run(async () => {
        await window.khepreeLivestreamAI.toggleTakeover(accountId.trim());
        await refresh();
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [accountId, hotkey, run, refresh]);

  return (
    <section className="controlStripWrap">
      <div className="controlStrip">
        <div className="modeSelect">
          <label className="labelWithHelp">
            <span>{t("control.mode")}</span>
            <MicroHelp tipId={modeTipId} />
          </label>
          <select
            value={snapshot.automationMode}
            disabled={!accountId}
            onChange={(e) =>
              void run(() => {
                const id = requireFocusedAccountId(snapshot);
                return window.khepreeLivestreamAI.setAutomationMode(
                  id,
                  e.target.value as AutomationMode
                );
              })
            }
          >
            {MODES.map((mode) => (
              <option key={mode} value={mode}>
                {labelAutomationMode(t, mode)}
              </option>
            ))}
          </select>
        </div>
        <div className="statePill">
          {t("control.state")}: <strong>{labelLiveState(t, snapshot.liveState)}</strong>
        </div>
        <div className="grow" />
        {snapshot.liveRunning && accountId ? (
          inTakeover ? (
            <button type="button" className="primary" onClick={() => void exitTakeover()}>
              <RotateCcw size={16} /> {t("operator.release")}
            </button>
          ) : (
            <button type="button" className="ghost" onClick={() => void takeover()}>
              <Hand size={16} /> {t("operator.takeover")}
              <span className="hotkeyHint">{hotkey}</span>
            </button>
          )
        ) : null}
        <button type="button" className="danger" onClick={() => void emergencyStop()}>
          <Siren size={16} /> {t("operator.emergency")}
        </button>
        {!snapshot.liveRunning ? (
          <div className="controlWithHelp">
            <button
              className="primary"
              disabled={blocked || !accountId}
              title={
                !accountId
                  ? t("accounts.needFocus")
                  : blocked
                    ? readiness.startBlockedReason
                    : undefined
              }
              onClick={() => {
                if (blocked || !accountId) return;
                void run(() =>
                  window.khepreeLivestreamAI.startLive(requireFocusedAccountId(snapshot))
                );
              }}
            >
              {t("control.start")}
            </button>
            <MicroHelp tipId="control.start_ai" />
          </div>
        ) : (
          <button
            className="danger"
            disabled={!accountId}
            onClick={() =>
              void run(() =>
                window.khepreeLivestreamAI.stopLive(requireFocusedAccountId(snapshot))
              )
            }
          >
            <MicOff size={16} /> {t("control.stop")}
          </button>
        )}
      </div>

      {emergency ? (
        <div className="emergencyBanner" role="alert">
          {t("operator.emergency.banner")}
        </div>
      ) : null}

      {blocked ? (
        <div className="startBlockedBanner" role="status">
          <p className="startBlockedReason">{readiness.startBlockedReason}</p>
          <ul className="startBlockedList">
            {blocking.map((item) => (
              <li key={item.id}>
                <span>
                  {item.label}: {item.detail}
                </span>
                {item.cta ? (
                  <button
                    type="button"
                    className="ghost small"
                    onClick={() => setTab(item.cta!.tab)}
                  >
                    {item.cta.label}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          <button type="button" className="ghost small" onClick={() => setTab("overview")}>
            {t("overview.cta.openChecklist")}
          </button>
        </div>
      ) : null}

      {!blocked && !snapshot.liveRunning && readiness.warningCount > 0 ? (
        <p className="startWarnNote" role="status">
          {t("overview.start.warnSteps", { count: readiness.warningCount })}
        </p>
      ) : null}
    </section>
  );
}
