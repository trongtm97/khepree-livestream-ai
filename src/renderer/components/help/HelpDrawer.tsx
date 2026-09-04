import { X } from "lucide-react";
import { useAppShell } from "../../app/AppShellContext";
import { getHelpArticle, getPageGuide, pickLocale } from "../../help";

export function HelpDrawer() {
  const { locale, t, helpDrawer, closeHelp, setTab } = useAppShell();
  if (!helpDrawer) return null;

  const pageGuide =
    helpDrawer.kind === "page" ? getPageGuide(helpDrawer.pageId) : undefined;
  const article =
    helpDrawer.kind === "article" ? getHelpArticle(helpDrawer.articleId) : undefined;

  const title = pageGuide
    ? pickLocale(pageGuide.title, locale)
    : article
      ? pickLocale(article.title, locale)
      : t("help.drawerMissing");

  const sections = pageGuide?.sections ?? article?.sections ?? [];

  return (
    <div className="helpDrawerRoot" role="presentation" onClick={closeHelp}>
      <aside
        className="helpDrawer"
        role="dialog"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="helpDrawerHead">
          <div>
            <p className="helpDrawerEyebrow">{t("help.drawerEyebrow")}</p>
            <h2>{title}</h2>
          </div>
          <button type="button" className="ghost small" onClick={closeHelp} aria-label={t("help.close")}>
            <X size={16} />
          </button>
        </div>

        <div className="helpDrawerBody">
          {sections.map((section) => (
            <section key={pickLocale(section.heading, locale)} className="helpDrawerSection">
              <h3>{pickLocale(section.heading, locale)}</h3>
              <p>{pickLocale(section.body, locale)}</p>
            </section>
          ))}

          {helpDrawer.kind === "page" ? (
            <button
              type="button"
              className="ghost small"
              onClick={() => {
                closeHelp();
                setTab("help");
              }}
            >
              {t("help.openCenter")}
            </button>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
