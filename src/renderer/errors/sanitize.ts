/** Strip secrets / dumps before showing technical details to operators. */

const REDACT = "[redacted]";

const SENSITIVE =
  /(authorization\s*[:=]\s*["']?bearer\s+)[^\s"'\\]+|(cookie\s*[:=]\s*)[^;\s]+|(access[_-]?token|refresh[_-]?token|id_token|api[_-]?key|secret|password)\s*[:=]\s*["']?[^\s"'&,;]+|(eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+)/gi;

const STACK_LINE = /^\s*at\s+.+$/gm;

export function sanitizeTechnicalText(input: string, maxLen = 800): string {
  let text = input.replace(/\r\n/g, "\n").trim();
  text = text.replace(STACK_LINE, "");
  text = text.replace(SENSITIVE, (_m, ...groups: unknown[]) => {
    const prefix = typeof groups[0] === "string" ? groups[0] : "";
    return `${prefix}${REDACT}`;
  });
  // Collapse leftover blank lines from stack stripping
  text = text.replace(/\n{3,}/g, "\n\n").trim();
  if (text.length > maxLen) text = `${text.slice(0, maxLen)}…`;
  return text;
}

export function looksLikeRawDump(text: string): boolean {
  if (text.length > 400) return true;
  if (/stack trace|traceback|at Object\.|node_modules/i.test(text)) return true;
  if (/^\s*\{[\s\S]*"error"[\s\S]*\}$/.test(text)) return true;
  return false;
}
