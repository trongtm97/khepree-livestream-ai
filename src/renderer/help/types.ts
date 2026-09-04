import type { AppLocale } from "../../shared/locale";
import type { AppTab } from "../app/types";

export type LocalizedText = Record<AppLocale, string>;

export type HelpArticle = {
  id: string;
  title: LocalizedText;
  summary: LocalizedText;
  sections: Array<{ heading: LocalizedText; body: LocalizedText }>;
  /** Search tokens in both languages (offline). */
  keywords: string[];
};

export type MicroTip = {
  id: string;
  title: LocalizedText;
  body: LocalizedText;
};

export type PageGuide = {
  pageId: AppTab;
  title: LocalizedText;
  sections: Array<{ heading: LocalizedText; body: LocalizedText }>;
};

export type HelpDrawerState =
  | { kind: "page"; pageId: AppTab }
  | { kind: "article"; articleId: string }
  | null;

export function pickLocale(text: LocalizedText, locale: AppLocale): string {
  return text[locale] || text.vi;
}
