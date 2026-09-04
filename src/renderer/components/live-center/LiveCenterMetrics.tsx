import type { AppSnapshot } from "../../../shared/ipc";
import { useAppShell } from "../../app/AppShellContext";

function geminiLabel(
  snapshot: AppSnapshot,
  t: ReturnType<typeof useAppShell>["t"]
): string {
  const g = snapshot.gemini;
  if (g.usingFallbackScript || g.phase === "FALLBACK_SCRIPT") return t("liveCenter.gemini.fallback");
  if (g.phase === "READY" || g.phase === "SLOW" || g.phase === "DEMO") return t("liveCenter.gemini.ready");
  return t("liveCenter.gemini.error");
}

function geminiTone(snapshot: AppSnapshot): "ready" | "fallback" | "error" {
  const g = snapshot.gemini;
  if (g.usingFallbackScript || g.phase === "FALLBACK_SCRIPT") return "fallback";
  if (g.phase === "READY" || g.phase === "SLOW" || g.phase === "DEMO") return "ready";
  return "error";
}

function machineLabel(
  snapshot: AppSnapshot,
  t: ReturnType<typeof useAppShell>["t"]
): string {
  const bad = snapshot.health.some(
    (h) => h.status === "DOWN" || h.status === "DEGRADED"
  );
  return bad ? t("liveCenter.machine.check") : t("liveCenter.machine.ok");
}

function machineTone(snapshot: AppSnapshot): "ready" | "warn" {
  const bad = snapshot.health.some(
    (h) => h.status === "DOWN" || h.status === "DEGRADED"
  );
  return bad ? "warn" : "ready";
}

export function LiveCenterMetrics({
  snapshot,
  todoCount
}: {
  snapshot: AppSnapshot;
  todoCount: number;
}) {
  const { t } = useAppShell();
  const accountCount = snapshot.lives.length;
  const liveCount = snapshot.lives.filter((l) => l.isRunning).length;
  const max = snapshot.maxConcurrentLives;
  const gTone = geminiTone(snapshot);
  const mTone = machineTone(snapshot);

  return (
    <div className="liveCenterMetrics" role="group" aria-label={t("liveCenter.metrics.aria")}>
      <div className="liveCenterMetric">
        <span>{t("liveCenter.metrics.accounts")}</span>
        <strong>{accountCount}</strong>
      </div>
      <div className="liveCenterMetric">
        <span>{t("liveCenter.metrics.live")}</span>
        <strong>
          {liveCount} / {max}
        </strong>
      </div>
      <div className={`liveCenterMetric tone-${gTone}`}>
        <span>{t("liveCenter.metrics.gemini")}</span>
        <strong>{geminiLabel(snapshot, t)}</strong>
      </div>
      <div className={`liveCenterMetric ${todoCount > 0 ? "tone-warn" : ""}`}>
        <span>{t("liveCenter.metrics.todos")}</span>
        <strong>{todoCount}</strong>
      </div>
      <div className={`liveCenterMetric tone-${mTone}`}>
        <span>{t("liveCenter.metrics.machine")}</span>
        <strong>{machineLabel(snapshot, t)}</strong>
      </div>
    </div>
  );
}
