import { Play, ShieldAlert, Square } from "lucide-react";
import type { AppSnapshot } from "../../../shared/ipc";
import type { AutomationMode } from "../../../shared/live-types";
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
  const { t, run, setTab, notify } = useAppShell();
  const modeTipId = MODE_TIP[snapshot.automationMode] ?? "mode.supervised_auto";
  const readiness = buildReadiness(snapshot, t);
  const blocked = !snapshot.liveRunning && !readiness.canStartLive;
  const blocking = readiness.items.filter((x) => x.severity === "BLOCKING" && !x.ready);

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
            onChange={(e) =>
              void run(() =>
                window.khepreeLivestreamAI.setAutomationMode(e.target.value as AutomationMode)
              )
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
        {snapshot.liveRunning ? (
          <div className="controlWithHelp">
            <button
              className="dangerOutline"
              title={t("emergency.stopBody")}
              onClick={() =>
                void run(async () => {
                  // Deliberately does NOT stop the livestream: the operator stays
                  // on air, only the AI stops acting on its own.
                  const dropped = await window.khepreeLivestreamAI.emergencyStop();
                  notify({
                    tone: "warning",
                    title: t("emergency.stopTitle"),
                    message:
                      dropped > 0 ? t("emergency.done", { count: dropped }) : t("emergency.none")
                  });
                })
              }
            >
              <ShieldAlert size={18} /> {t("emergency.stop")}
            </button>
            <MicroHelp tipId="emergency.stop" />
          </div>
        ) : null}
        {!snapshot.liveRunning ? (
          <div className="controlWithHelp">
            <button
              className="primary"
              disabled={blocked}
              title={blocked ? readiness.startBlockedReason : undefined}
              onClick={() => {
                if (blocked) return;
                void run(() => window.khepreeLivestreamAI.startLive());
              }}
            >
              <Play size={18} /> {t("control.start")}
            </button>
            <MicroHelp tipId="control.start_ai" />
          </div>
        ) : (
          <button className="danger" onClick={() => void run(() => window.khepreeLivestreamAI.stopLive())}>
            <Square size={18} /> {t("control.stop")}
          </button>
        )}
      </div>

      {blocked ? (
        <div className="startBlockedBanner" role="status">
          <p className="startBlockedReason">{readiness.startBlockedReason}</p>
          <ul className="startBlockedList">
            {blocking.map((item) => (
              <li key={item.id}>
                <span>{item.label}: {item.detail}</span>
                {item.cta ? (
                  <button type="button" className="ghost small" onClick={() => setTab(item.cta!.tab)}>
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
