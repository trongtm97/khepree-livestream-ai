import type { AppSnapshot } from "../../../shared/ipc";
import type { SystemResourcePublicSnapshot } from "../../../shared/system-resources";
import { useAppShell } from "../../app/AppShellContext";

const GPU_HIGH_PERCENT = 85;
const CPU_HIGH_PERCENT = 85;
const RAM_HIGH_PERCENT = 90;

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

function gpuUtilization(resources?: SystemResourcePublicSnapshot): number | undefined {
  if (!resources || resources.gpu === "UNKNOWN") return undefined;
  const u = resources.gpu.utilizationPercent;
  return typeof u === "number" ? u : undefined;
}

function machineLabel(
  snapshot: AppSnapshot,
  t: ReturnType<typeof useAppShell>["t"]
): string {
  const bad = snapshot.health.some(
    (h) => h.status === "DOWN" || h.status === "DEGRADED"
  );
  if (bad) return t("liveCenter.machine.check");

  const gpu = gpuUtilization(snapshot.resources);
  if (gpu !== undefined && gpu >= GPU_HIGH_PERCENT) {
    return t("liveCenter.machine.gpuHigh");
  }

  const cpu = snapshot.resources?.cpuLoadPercent;
  if (typeof cpu === "number" && cpu >= CPU_HIGH_PERCENT) {
    return t("liveCenter.machine.cpuHigh");
  }

  const ram = snapshot.resources?.ramUsedPercent;
  if (typeof ram === "number" && ram >= RAM_HIGH_PERCENT) {
    return t("liveCenter.machine.ramHigh");
  }

  return t("liveCenter.machine.ok");
}

function machineTone(snapshot: AppSnapshot): "ready" | "warn" {
  const bad = snapshot.health.some(
    (h) => h.status === "DOWN" || h.status === "DEGRADED"
  );
  if (bad) return "warn";
  const gpu = gpuUtilization(snapshot.resources);
  if (gpu !== undefined && gpu >= GPU_HIGH_PERCENT) return "warn";
  const cpu = snapshot.resources?.cpuLoadPercent;
  if (typeof cpu === "number" && cpu >= CPU_HIGH_PERCENT) return "warn";
  const ram = snapshot.resources?.ramUsedPercent;
  if (typeof ram === "number" && ram >= RAM_HIGH_PERCENT) return "warn";
  return "ready";
}

function formatMetric(v: number | "UNKNOWN" | undefined, suffix = ""): string {
  if (typeof v !== "number") return "—";
  return `${v}${suffix}`;
}

function advancedDetail(
  resources: SystemResourcePublicSnapshot | undefined,
  t: ReturnType<typeof useAppShell>["t"]
): string | null {
  if (!resources) return null;
  const cpu = formatMetric(resources.cpuLoadPercent, "%");
  const ram =
    typeof resources.ramUsedPercent === "number"
      ? formatMetric(resources.ramUsedPercent, "%")
      : typeof resources.ramAvailableMb === "number"
        ? `${resources.ramAvailableMb} MB free`
        : "—";
  let gpu = "—";
  let vram = "—";
  if (resources.gpu !== "UNKNOWN") {
    gpu = formatMetric(resources.gpu.utilizationPercent, "%");
    const free = resources.gpu.vramFreeMb;
    const total = resources.gpu.vramTotalMb;
    if (typeof free === "number" && typeof total === "number") {
      vram = `${free}/${total} MB`;
    } else if (typeof free === "number") {
      vram = `${free} MB free`;
    }
  }
  return t("liveCenter.machine.advanced", { cpu, ram, gpu, vram });
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
  const detail = advancedDetail(snapshot.resources, t);

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
        {detail ? <em className="liveCenterMetricDetail">{detail}</em> : null}
      </div>
    </div>
  );
}
