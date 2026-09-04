import { Activity, MessageSquareText, Radio, ShieldCheck } from "lucide-react";
import type { AppSnapshot } from "../../../shared/ipc";
import { useAppShell } from "../../app/AppShellContext";
import { labelKhepreeStatus } from "../../i18n";
import { MetricCard } from "../common/MetricCard";

export function LiveStatusCards({ snapshot }: { snapshot: AppSnapshot }) {
  const { t } = useAppShell();
  const pending = snapshot.approvals;
  const healthOk = snapshot.health.filter((x) => x.status === "OK").length;

  return (
    <section className="metricGrid">
      <MetricCard
        icon={<Radio />}
        label={t("metric.live")}
        value={snapshot.liveRunning ? t("metric.running") : t("metric.stopped")}
        tone={snapshot.liveRunning ? "green" : "neutral"}
      />
      <MetricCard
        icon={<ShieldCheck />}
        label={t("metric.khepree")}
        value={labelKhepreeStatus(t, snapshot.khepree.status)}
        tone={snapshot.khepree.status === "ACTIVE" ? "green" : "amber"}
      />
      <MetricCard
        icon={<MessageSquareText />}
        label={t("metric.approvals")}
        value={String(pending.length)}
        tone={pending.length ? "amber" : "green"}
      />
      <MetricCard
        icon={<Activity />}
        label={t("metric.health")}
        value={`${healthOk}/${snapshot.health.length}`}
        tone={healthOk === snapshot.health.length ? "green" : "amber"}
      />
    </section>
  );
}
