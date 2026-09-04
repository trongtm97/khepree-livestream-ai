import type { AppLocale } from "../../shared/locale";
import { HELP_ARTICLES } from "./helpRegistry";
import { pickLocale, type HelpArticle } from "./types";

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim();
}

export function searchHelpArticles(query: string, locale: AppLocale): HelpArticle[] {
  const q = normalize(query);
  if (!q) return HELP_ARTICLES;

  return HELP_ARTICLES.filter((article) => {
    const haystack = normalize(
      [
        pickLocale(article.title, locale),
        pickLocale(article.summary, locale),
        ...article.keywords,
        ...article.sections.flatMap((section) => [
          pickLocale(section.heading, locale),
          pickLocale(section.body, locale)
        ])
      ].join("\n")
    );
    return q.split(/\s+/).every((token) => haystack.includes(token));
  });
}
