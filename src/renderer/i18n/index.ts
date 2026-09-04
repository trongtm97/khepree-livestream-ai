import { DEFAULT_APP_LOCALE, type AppLocale } from "../../shared/locale";
import type {
  ActionKind,
  AutomationMode,
  LiveState,
  RuntimeHealth
} from "../../shared/live-types";
import type { KhepreeAccessStatus } from "../../shared/khepree-contracts";
import { resolveAppError } from "../errors";
import { en } from "./en";
import type { MessageKey, TranslateFn } from "./types";
import { vi } from "./vi";

const dictionaries: Record<AppLocale, Record<MessageKey, string>> = {
  vi,
  en
};

export function createTranslator(locale: AppLocale = DEFAULT_APP_LOCALE): TranslateFn {
  const dict = dictionaries[locale] ?? dictionaries.vi;
  return (key, vars) => {
    let text = dict[key] ?? vi[key] ?? String(key);
    if (vars) {
      for (const [name, value] of Object.entries(vars)) {
        text = text.replaceAll(`{${name}}`, String(value));
      }
    }
    return text;
  };
}

export function t(
  locale: AppLocale,
  key: MessageKey,
  vars?: Record<string, string | number>
): string {
  return createTranslator(locale)(key, vars);
}

export function labelAutomationMode(tFn: TranslateFn, mode: AutomationMode): string {
  return tFn(`mode.${mode}`);
}

export function labelLiveState(tFn: TranslateFn, state: string): string {
  const key = `liveState.${state}` as MessageKey;
  return key in vi ? tFn(key) : state;
}

export function labelActionKind(tFn: TranslateFn, kind: ActionKind | string): string {
  const key = `actionKind.${kind}` as MessageKey;
  return key in vi ? tFn(key) : kind;
}

export function labelHealthStatus(
  tFn: TranslateFn,
  status: RuntimeHealth["status"] | string
): string {
  const key = `healthStatus.${status}` as MessageKey;
  return key in vi ? tFn(key) : status;
}

export function labelHealthComponent(tFn: TranslateFn, component: string): string {
  const key = `health.component.${component.replace(/:/g, "_")}` as MessageKey;
  return key in vi ? tFn(key) : component;
}

export function labelKhepreeStatus(tFn: TranslateFn, status: KhepreeAccessStatus | string): string {
  const key = `khepreeStatus.${status}` as MessageKey;
  return key in vi ? tFn(key) : status;
}

export function labelPlanSlug(tFn: TranslateFn, slug: string): string {
  const key = `plan.${slug}` as MessageKey;
  return key in vi ? tFn(key) : slug;
}

export function explainError(_tFn: TranslateFn, error: unknown): string {
  return resolveAppError(error, "vi").userMessage;
}

export function intlLocale(locale: AppLocale): string {
  return locale === "en" ? "en-US" : "vi-VN";
}

export type { MessageKey, TranslateFn };
export { vi, en };
