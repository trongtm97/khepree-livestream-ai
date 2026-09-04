import { BookOpen, Languages, RefreshCw, UserRound } from "lucide-react";
import type { AppSnapshot } from "../../../shared/ipc";
import { APP_LOCALES, type AppLocale } from "../../../shared/locale";
import { useAppShell } from "../../app/AppShellContext";
import { getNavItem } from "../../app/nav";
import { buildReadiness } from "../../app/readiness";
import { PageGuideButton } from "../help/PageGuideButton";

export function AppHeader({ snapshot }: { snapshot: AppSnapshot }) {
  const { t, tab, locale, loading, refresh, changeLocale, setTab, run } = useAppShell();
  const nav = getNavItem(tab);
  const readiness = buildReadiness(snapshot, t);
  const accountLabel = snapshot.khepree.user
    ? t("header.accountSignedIn", { name: snapshot.khepree.user.name })
    : t("header.accountSignIn");

  return (
    <header className="topBar">
      <div className="topBarTitle">
        <div className="topBarTitleRow">
          <h1>{t(nav.headerKey)}</h1>
          <PageGuideButton />
        </div>
        <p>{t("app.tagline")}</p>
      </div>

      <div className="headerActions">
        <div className={`overallChip ${readiness.tone}`} title={readiness.detail}>
          <span className="overallDot" />
          <span>{readiness.label}</span>
        </div>

        <label className="localeSelect accountFocusSelect">
          <UserRound size={16} />
          <select
            value={snapshot.focusedAccountId ?? ""}
            disabled={loading || snapshot.lives.length === 0}
            aria-label={t("accounts.title")}
            onChange={(e) => {
              const id = e.target.value;
              if (!id) return;
              void run(async () => {
                await window.khepreeLivestreamAI.setFocusedAccount(id);
                await refresh();
              });
            }}
          >
            {snapshot.lives.length === 0 ? (
              <option value="">{t("accounts.empty")}</option>
            ) : (
              snapshot.lives.map((live) => (
                <option key={live.accountId} value={live.accountId}>
                  {live.username}
                  {live.isRunning ? " · LIVE" : ""}
                  {live.label ? ` (${live.label})` : ""}
                </option>
              ))
            )}
          </select>
        </label>

        <label className="localeSelect">
          <Languages size={16} />
          <select
            value={locale}
            disabled={loading}
            onChange={(e) => void changeLocale(e.target.value as AppLocale)}
            aria-label={t("settings.languageLabel")}
          >
            {APP_LOCALES.map((code) => (
              <option key={code} value={code}>
                {code === "vi" ? t("settings.languageVi") : t("settings.languageEn")}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="ghost accountChip"
          onClick={() => {
            if (snapshot.khepree.status === "ACTIVE") {
              setTab("connections");
              return;
            }
            void run(() => window.khepreeLivestreamAI.startKhepreeLogin());
          }}
        >
          <UserRound size={16} />
          <span>{accountLabel}</span>
        </button>

        <button type="button" className="ghost" onClick={() => setTab("help")}>
          <BookOpen size={16} />
          {t("header.helpButton")}
        </button>

        <button type="button" className="ghost" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw size={17} /> {t("header.refresh")}
        </button>
      </div>
    </header>
  );
}
