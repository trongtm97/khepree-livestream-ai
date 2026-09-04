import type { AppSnapshot } from "../../shared/ipc";
import { useAppShell } from "../app/AppShellContext";
import { buildReadiness } from "../app/readiness";
import { ReadinessChecklist } from "../components/common/ReadinessChecklist";

export function OverviewPage({ snapshot }: { snapshot: AppSnapshot }) {
  const { t } = useAppShell();
  const readiness = buildReadiness(snapshot, t);

  return (
    <section className="overviewPage">
      <ReadinessChecklist readiness={readiness} title={t("overview.checklistTitle")} />
    </section>
  );
}
