import type { AppLocale } from "../../shared/locale";
import type { ErrorGroup, ErrorSeverity } from "../../shared/errors";
import { getErrorCopy } from "./catalog";
import { parseUnknownError, safeTechnicalDetails } from "./parseError";

export type ResolvedAppError = {
  title: string;
  userMessage: string;
  recommendedActions: string[];
  technicalCode: string;
  technicalDetails?: string;
  group: ErrorGroup;
  severity: ErrorSeverity;
};

export function resolveAppError(error: unknown, locale: AppLocale): ResolvedAppError {
  const parsed = parseUnknownError(error);
  const copy = getErrorCopy(parsed.code);
  const technicalDetails = safeTechnicalDetails(parsed);
  const max = parsed.rawDetail?.match(/^\d+$/)?.[0];
  const fill = (text: string) =>
    max !== undefined ? text.replaceAll("{max}", max) : text.replaceAll("{max}", "—");

  return {
    title: fill(copy.title[locale] || copy.title.vi),
    userMessage: fill(copy.userMessage[locale] || copy.userMessage.vi),
    recommendedActions: copy.recommendedActions[locale] || copy.recommendedActions.vi,
    technicalCode: parsed.code,
    technicalDetails,
    group: parsed.group,
    severity: parsed.severity
  };
}
