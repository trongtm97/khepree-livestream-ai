import type { RuntimeHealth } from "./live-types";

export type LlmProviderId = "mock" | "gemini-web";

/** Seller-facing Gemini / LLM connector phase (never expose raw cookies). */
export type GeminiConnectionPhase =
  | "READY"
  | "NOT_SIGNED_IN"
  | "REAUTH_REQUIRED"
  | "SLOW"
  | "QUOTA_EXCEEDED"
  | "CONNECTOR_ERROR"
  | "DISCONNECTED"
  | "DEMO"
  | "STARTING"
  | "CIRCUIT_OPEN"
  /** Gemini preferred but unavailable — ScriptBrain is answering. */
  | "FALLBACK_SCRIPT";

export type GeminiWorkerLifecycle = "STOPPED" | "STARTING" | "RUNNING" | "ERROR";

export type GeminiAccountStatus =
  | "UNKNOWN"
  | "SIGNED_IN"
  | "NOT_SIGNED_IN"
  | "EXPIRED";

/** Public state for renderer — no secrets. */
export interface GeminiPublicState {
  preferredProvider: LlmProviderId;
  activeProvider: LlmProviderId;
  /** True when operator explicitly allows mock as a labeled demo. */
  demoModeAcknowledged: boolean;
  phase: GeminiConnectionPhase;
  worker: GeminiWorkerLifecycle;
  account: GeminiAccountStatus;
  model?: string;
  models: string[];
  latencyMs?: number;
  lastCheckedAt?: string;
  message?: string;
  circuitOpen: boolean;
  dependencyInstalled?: boolean;
  /** True when encrypted session cookies exist in main (never the values). */
  hasEncryptedSession: boolean;
  /**
   * True when livestream answers come from fallback sales scripts
   * because Gemini is temporarily unavailable — never pretend Gemini is healthy.
   */
  usingFallbackScript: boolean;
}

/** Result of worker + dependency probe (onboarding steps 1–2). */
export interface GeminiProbeResult {
  workerOk: boolean;
  dependencyInstalled: boolean;
  message: string;
  /** Stable code for seller-facing guide copy. */
  guideCode?:
    | "OK"
    | "PYTHON_MISSING"
    | "WORKER_SCRIPT_MISSING"
    | "WORKER_TIMEOUT"
    | "DEPENDENCY_MISSING"
    | "WORKER_ERROR";
}

/** Result of a simple generate smoke test. */
export interface GeminiTestResult {
  ok: boolean;
  text: string;
  latencyMs: number;
  message?: string;
}

export interface GeminiHealthDetail extends RuntimeHealth {
  phase: GeminiConnectionPhase;
  account: GeminiAccountStatus;
  worker: GeminiWorkerLifecycle;
  dependencyInstalled?: boolean;
  model?: string;
}
