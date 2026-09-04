import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useAppShell } from "../app/AppShellContext";
import { listHelpArticles, pickLocale, searchHelpArticles } from "../help";

export function HelpPage() {
  const { locale, t, setTab } = useAppShell();
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

  const results = useMemo(
    () => searchHelpArticles(query, locale),
    [query, locale]
  );

  const active = results.find((article) => article.id === activeId) ?? results[0] ?? null;

  return (
    <section className="helpCenter">
      <div className="helpCenterIntro panel">
        <h2>{t("help.centerTitle")}</h2>
        <p>{t("help.centerLead")}</p>
        <label className="helpSearch">
          <Search size={16} />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveId(null);
            }}
            placeholder={t("help.searchPlaceholder")}
          />
        </label>
        <p className="helpTip">{t("help.offlineNote")}</p>
      </div>

      <div className="helpCenterGrid">
        <aside className="panel helpArticleList">
          <h3>{t("help.articlesHeading")}</h3>
          {results.length === 0 ? (
            <p className="helpEmpty">{t("help.noResults")}</p>
          ) : (
            <ul>
              {results.map((article) => (
                <li key={article.id}>
                  <button
                    type="button"
                    className={active?.id === article.id ? "active" : ""}
                    onClick={() => setActiveId(article.id)}
                  >
                    <strong>{pickLocale(article.title, locale)}</strong>
                    <span>{pickLocale(article.summary, locale)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="ghost small" onClick={() => setTab("overview")}>
            {t("nav.overview")}
          </button>
        </aside>

        <article className="panel helpArticleDetail">
          {active ? (
            <>
              <h2>{pickLocale(active.title, locale)}</h2>
              <p className="helpArticleSummary">{pickLocale(active.summary, locale)}</p>
              {active.sections.map((section) => (
                <section key={pickLocale(section.heading, locale)} className="helpDrawerSection">
                  <h3>{pickLocale(section.heading, locale)}</h3>
                  <p>{pickLocale(section.body, locale)}</p>
                </section>
              ))}
            </>
          ) : (
            <p className="helpEmpty">{t("help.noResults")}</p>
          )}
        </article>
      </div>

      {!query.trim() ? (
        <p className="helpTip">
          {t("help.articleCount", { count: listHelpArticles().length })}
        </p>
      ) : null}
    </section>
  );
}
