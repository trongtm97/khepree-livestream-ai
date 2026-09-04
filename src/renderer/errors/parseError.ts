import { ERROR_CODES, lookupErrorMeta, type ParsedError } from "../../shared/errors";
import { looksLikeRawDump, sanitizeTechnicalText } from "./sanitize";

/** Heuristic map free-form worker messages → stable codes. */
const MESSAGE_HINTS: Array<{ test: RegExp; code: string }> = [
  { test: /gemini\s+init\s+failed/i, code: ERROR_CODES.GEMINI_INIT_FAILED },
  { test: /gemini\s+generation\s+failed/i, code: ERROR_CODES.GEMINI_GENERATION_FAILED },
  { test: /worker script missing/i, code: ERROR_CODES.PYTHON_WORKER_SCRIPT_MISSING },
  { test: /startup timeout/i, code: ERROR_CODES.PYTHON_WORKER_STARTUP_TIMEOUT },
  { test: /not started/i, code: ERROR_CODES.PYTHON_WORKER_NOT_STARTED },
  { test: /approval item not pending/i, code: ERROR_CODES.APPROVAL_NOT_PENDING }
];

function stripErrorPrefix(raw: string): string {
  return raw.replace(/^Error:\s*/i, "").trim();
}

function extractCodeCandidate(text: string): { code: string; rest?: string } {
  const cleaned = stripErrorPrefix(text);
  // CODE or CODE:detail
  const match = /^([A-Z][A-Z0-9_]+)\s*(?::\s*(.*))?$/.exec(cleaned);
  if (match?.[1]) {
    return { code: match[1], rest: match[2]?.trim() || undefined };
  }
  for (const hint of MESSAGE_HINTS) {
    if (hint.test.test(cleaned)) {
      return { code: hint.code, rest: cleaned };
    }
  }
  return { code: ERROR_CODES.UNKNOWN, rest: cleaned || undefined };
}

export function parseUnknownError(error: unknown): ParsedError {
  let raw = "";
  if (error instanceof Error) raw = error.message || error.name;
  else if (typeof error === "string") raw = error;
  else if (error && typeof error === "object" && "message" in error) {
    raw = String((error as { message: unknown }).message);
  } else raw = String(error ?? "");

  const { code: candidate, rest } = extractCodeCandidate(raw);
  const meta = lookupErrorMeta(candidate);
  // If candidate was unknown SCREAMING_SNAKE not in catalog, keep it as technical code
  const code =
    meta.code === ERROR_CODES.UNKNOWN && /^[A-Z][A-Z0-9_]+$/.test(candidate)
      ? candidate
      : meta.code === ERROR_CODES.UNKNOWN
        ? ERROR_CODES.UNKNOWN
        : meta.code;

  const group = lookupErrorMeta(code).group;
  const severity = lookupErrorMeta(code).severity;

  let rawDetail = rest;
  if (!rawDetail && code === ERROR_CODES.UNKNOWN && raw) {
    rawDetail = stripErrorPrefix(raw);
  }

  return {
    code,
    group: group === "unknown" && code !== ERROR_CODES.UNKNOWN ? "system" : group,
    severity,
    rawDetail
  };
}

export function safeTechnicalDetails(parsed: ParsedError): string | undefined {
  if (!parsed.rawDetail) return undefined;
  if (looksLikeRawDump(parsed.rawDetail)) {
    return sanitizeTechnicalText(parsed.rawDetail.slice(0, 200));
  }
  return sanitizeTechnicalText(parsed.rawDetail);
}
