export type { ErrorCopy, LocalizedLines, LocalizedText } from "./catalog";
export { ERROR_COPY, getErrorCopy } from "./catalog";
export { parseUnknownError, safeTechnicalDetails } from "./parseError";
export { resolveAppError, type ResolvedAppError } from "./resolveError";
export { sanitizeTechnicalText, looksLikeRawDump } from "./sanitize";
