/** Map raw Gemini/worker failures to stable IPC error codes (no raw dumps to sellers). */
export function mapGeminiFailureCode(error: unknown): string {
  const raw = String(error instanceof Error ? error.message : error);
  const codeMatch = /^([A-Z][A-Z0-9_]+)\b/.exec(raw.replace(/^Error:\s*/i, ""));
  if (codeMatch?.[1] && KNOWN.has(codeMatch[1])) return codeMatch[1];

  const lower = raw.toLowerCase();
  if (lower.includes("not installed") || lower.includes("gemini_webapi")) {
    return "GEMINI_DEPENDENCY_MISSING";
  }
  if (lower.includes("script missing") || lower.includes("worker script missing")) {
    return "PYTHON_WORKER_SCRIPT_MISSING";
  }
  if (lower.includes("startup timeout")) return "PYTHON_WORKER_STARTUP_TIMEOUT";
  if (lower.includes("not started") || lower.includes("enoent") || lower.includes("python")) {
    if (lower.includes("python") || lower.includes("spawn")) return "PYTHON_WORKER_NOT_STARTED";
  }
  if (
    lower.includes("auth")
    || lower.includes("login")
    || lower.includes("cookie")
    || lower.includes("401")
    || lower.includes("403")
    || lower.includes("expired")
    || lower.includes("reauth")
  ) {
    return "GEMINI_REAUTH_REQUIRED";
  }
  if (
    lower.includes("browser")
    || lower.includes("playwright")
    || lower.includes("firefox")
    || lower.includes("chrome")
    || lower.includes("webview")
  ) {
    return "GEMINI_BROWSER_LOGIN_FAILED";
  }
  if (lower.includes("quota") || lower.includes("rate limit") || lower.includes("429")) {
    return "GEMINI_QUOTA_EXCEEDED";
  }
  return "GEMINI_INIT_FAILED";
}

export function toGeminiError(error: unknown): Error {
  const code = mapGeminiFailureCode(error);
  if (error instanceof Error && error.message.startsWith(code)) return error;
  return new Error(code);
}

const KNOWN = new Set([
  "GEMINI_NOT_CONNECTED",
  "GEMINI_INIT_FAILED",
  "GEMINI_GENERATION_FAILED",
  "GEMINI_DEPENDENCY_MISSING",
  "GEMINI_REAUTH_REQUIRED",
  "GEMINI_QUOTA_EXCEEDED",
  "GEMINI_CIRCUIT_OPEN",
  "GEMINI_BROWSER_LOGIN_FAILED",
  "GEMINI_TEST_FAILED",
  "GEMINI_SESSION_REQUIRED",
  "LLM_PROVIDER_INVALID",
  "PYTHON_WORKER_NOT_STARTED",
  "PYTHON_WORKER_SCRIPT_MISSING",
  "PYTHON_WORKER_STARTUP_TIMEOUT",
  "SAFE_STORAGE_UNAVAILABLE"
]);
