export const APP_LOCALES = ["vi", "en"] as const;

export type AppLocale = (typeof APP_LOCALES)[number];

export const DEFAULT_APP_LOCALE: AppLocale = "vi";

export function isAppLocale(value: unknown): value is AppLocale {
  return value === "vi" || value === "en";
}

export function normalizeAppLocale(value: unknown): AppLocale {
  return isAppLocale(value) ? value : DEFAULT_APP_LOCALE;
}
