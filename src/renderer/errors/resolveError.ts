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

  return {
    title: copy.title[locale] || copy.title.vi,
    userMessage: copy.userMessage[locale] || copy.userMessage.vi,
    recommendedActions: copy.recommendedActions[locale] || copy.recommendedActions.vi,
    technicalCode: parsed.code,
    technicalDetails,
    group: parsed.group,
    severity: parsed.severity
  };
}
