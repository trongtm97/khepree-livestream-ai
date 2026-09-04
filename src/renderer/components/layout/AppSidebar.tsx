import type { AppSnapshot } from "../../../shared/ipc";
import { useAppShell } from "../../app/AppShellContext";
import { NAV_ITEMS } from "../../app/nav";

export function AppSidebar({ snapshot }: { snapshot: AppSnapshot }) {
  const { t, tab, setTab } = useAppShell();

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brandMark">K</div>
        <div>
          <strong>Khepree</strong>
          <span>{t("app.brandSubtitle")}</span>
        </div>
      </div>

      <nav className="sidebarNav">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              className={tab === item.id ? "active" : ""}
              onClick={() => setTab(item.id)}
            >
              <Icon size={18} className="navIcon" />
              <span className="navLabel">{t(item.labelKey)}</span>
              {item.comingSoon ? (
                <span className="navBadge">{t("nav.comingSoon")}</span>
              ) : null}
            </button>
          );
        })}
      </nav>

      <div className="sidebarBottom">
        <small>v{snapshot.appVersion}</small>
      </div>
    </aside>
  );
}
