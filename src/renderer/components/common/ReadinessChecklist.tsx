import type { OverallReadiness, ReadinessItem } from "../../app/readiness";
import { readinessMark } from "../../app/readiness";
import { useAppShell } from "../../app/AppShellContext";

export function ReadinessChecklist({
  readiness,
  title,
  compact
}: {
  readiness: OverallReadiness;
  title?: string;
  compact?: boolean;
}) {
  const { t, setTab } = useAppShell();

  return (
    <section className={`readinessChecklist ${compact ? "compact" : ""}`}>
      {!compact ? (
        <header className={`readinessHero panel ${readiness.tone}`}>
          <div>
            <p className="overviewLead">{title ?? t("overview.checklistTitle")}</p>
            <h2>{readiness.label}</h2>
            <p>{readiness.detail}</p>
            <p className="overviewScore">
              {t("overview.score", { ready: readiness.readyCount, total: readiness.total })}
            </p>
          </div>
          <div className="row overviewActions">
            <button type="button" className="primary" onClick={() => setTab("live")}>
              {t("overview.cta.live")}
            </button>
            <button type="button" className="ghost" onClick={() => setTab("connections")}>
              {t("overview.cta.connections")}
            </button>
          </div>
        </header>
      ) : null}

      <div className={compact ? "readinessList" : "overviewGrid"}>
        {readiness.items.map((item) => (
          <ReadinessRow key={item.id} item={item} compact={compact} />
        ))}
      </div>

      {!compact ? <p className="overviewNote">{t("overview.honestNote")}</p> : null}
    </section>
  );
}

function ReadinessRow({ item, compact }: { item: ReadinessItem; compact?: boolean }) {
  const { setTab } = useAppShell();
  const mark = readinessMark(item);

  return (
    <div className={`checkCard ${item.tone} ${compact ? "checkRow" : ""}`}>
      <div className={`checkMark ${item.ready ? "yes" : item.severity === "OPTIONAL" ? "opt" : "no"}`}>
        {mark}
      </div>
      <div className="checkBody">
        <strong>{item.label}</strong>
        <p>{item.detail}</p>
      </div>
      {item.cta && !item.ready ? (
        <button type="button" className="ghost small checkCta" onClick={() => setTab(item.cta!.tab)}>
          {item.cta.label}
        </button>
      ) : null}
    </div>
  );
}
