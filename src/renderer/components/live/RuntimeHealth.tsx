import { Wifi } from "lucide-react";
import type { RuntimeHealth } from "../../../shared/live-types";
import { useAppShell } from "../../app/AppShellContext";
import { labelHealthComponent, labelHealthStatus } from "../../i18n";

export function RuntimeHealth({ items }: { items: RuntimeHealth[] }) {
  const { t } = useAppShell();

  return (
    <div className="panel">
      <div className="panelHead">
        <div>
          <h2>{t("health.title")}</h2>
          <p>{t("health.subtitle")}</p>
        </div>
        <Wifi />
      </div>
      <div className="healthList">
        {items.map((item) => (
          <div className="healthRow" key={item.component}>
            <span className={`dot ${item.status.toLowerCase()}`} />
            <div>
              <strong>{labelHealthComponent(t, item.component)}</strong>
              <small>{item.message}</small>
            </div>
            <b>{labelHealthStatus(t, item.status)}</b>
          </div>
        ))}
      </div>
    </div>
  );
}
