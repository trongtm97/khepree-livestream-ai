import path from "node:path";
import type { ActionProposal, RuntimeHealth } from "../../../shared/live-types";
import type {
  GeminiAccountStatus,
  GeminiConnectionPhase,
  GeminiWorkerLifecycle
} from "../../../shared/gemini-contracts";
import {
  askOperatorFromSalesBrainFailure,
  buildSalesBrainPrompt,
  parseAndValidateSalesBrainOutput,
  SALES_BRAIN_MAX_ATTEMPTS
} from "../../../shared/sales-brain";
import { HttpWorkerProcess } from "../../workers/http-worker-process";
import type { LlmContext, LlmProvider } from "./types";

export type GeminiInitAuth =
  | { authMode: "browser" }
  | { authMode: "cookies"; secure1PSID: string; secure1PSIDTS?: string };

export type GeminiInitResult = {
  ok: true;
  cookies?: { secure1PSID?: string | null; secure1PSIDTS?: string | null };
};

function mapPhaseFromMessage(
  message: string,
  ready: boolean,
  dependencyInstalled?: boolean
): GeminiConnectionPhase {
  const lower = message.toLowerCase();
  if (dependencyInstalled === false || lower.includes("not installed")) return "CONNECTOR_ERROR";
  if (anyMatch(lower, ["quota", "rate limit", "429", "resource exhausted"])) return "QUOTA_EXCEEDED";
  if (anyMatch(lower, ["auth", "login", "cookie", "401", "403", "expired", "sign in", "reauth"])) {
    return "REAUTH_REQUIRED";
  }
  if (ready) return "READY";
  return "NOT_SIGNED_IN";
}

function anyMatch(text: string, needles: string[]): boolean {
  return needles.some((n) => text.includes(n));
}

export class GeminiWorkerProvider implements LlmProvider {
  private readonly worker: HttpWorkerProcess;
  private lifecycle: GeminiWorkerLifecycle = "STOPPED";
  private lastError?: string;
  private selectedModel?: string;
  private lastLatencyMs?: number;
  private lastCheckedAt?: string;
  private dependencyInstalled?: boolean;
  private ready = false;

  constructor(appRoot: string, pythonExecutable = "python", startupTimeoutMs = 20000) {
    this.worker = new HttpWorkerProcess({
      name: "gemini-worker",
      scriptPath: path.join(appRoot, "workers", "gemini_worker", "app.py"),
      pythonExecutable,
      startupTimeoutMs
    });
  }

  getWorkerLifecycle(): GeminiWorkerLifecycle {
    return this.lifecycle;
  }

  getSelectedModel(): string | undefined {
    return this.selectedModel;
  }

  setSelectedModel(model: string | undefined): void {
    this.selectedModel = model?.trim() || undefined;
  }

  getLastLatencyMs(): number | undefined {
    return this.lastLatencyMs;
  }

  getLastCheckedAt(): string | undefined {
    return this.lastCheckedAt;
  }

  isReady(): boolean {
    return this.ready && this.lifecycle === "RUNNING";
  }

  async startWorker(): Promise<void> {
    if (this.lifecycle === "RUNNING") return;
    this.lifecycle = "STARTING";
    this.lastError = undefined;
    try {
      await this.worker.start();
      this.lifecycle = "RUNNING";
      // Peek health for dependency flag without requiring login.
      try {
        const res = await this.worker.request("/health", { method: "GET" });
        const body = (await res.json()) as { dependencyInstalled?: boolean; message?: string };
        this.dependencyInstalled = Boolean(body.dependencyInstalled);
        if (this.dependencyInstalled === false) {
          this.lastError = body.message ?? "gemini_webapi is not installed";
        }
      } catch {
        // ignore — probe will surface
      }
    } catch (error) {
      this.lifecycle = "ERROR";
      this.ready = false;
      this.lastError = String(error);
      throw error;
    }
  }

  /** Start worker only and report dependency status (no login). */
  async probe(): Promise<{
    workerOk: boolean;
    dependencyInstalled: boolean;
    message: string;
  }> {
    try {
      await this.startWorker();
      const res = await this.worker.request("/health", { method: "GET" });
      const body = (await res.json()) as {
        dependencyInstalled?: boolean;
        message?: string;
        ready?: boolean;
      };
      this.dependencyInstalled = Boolean(body.dependencyInstalled);
      return {
        workerOk: res.ok,
        dependencyInstalled: this.dependencyInstalled,
        message: body.message ?? (res.ok ? "worker ok" : "worker unhealthy")
      };
    } catch (error) {
      return {
        workerOk: false,
        dependencyInstalled: false,
        message: String(error)
      };
    }
  }

  /** Simple generate smoke test — verifies Gemini returns text. */
  async runSmokeTest(prompt?: string): Promise<{
    ok: boolean;
    text: string;
    latencyMs: number;
    message?: string;
  }> {
    if (this.lifecycle !== "RUNNING" || !this.ready) {
      throw new Error("GEMINI_NOT_CONNECTED");
    }
    const startedAt = Date.now();
    const res = await this.worker.request("/v1/generate", {
      method: "POST",
      body: JSON.stringify({
        prompt:
          prompt
          ?? "Reply with exactly the word OK and nothing else. Do not use markdown.",
        model: this.selectedModel,
        temporary: true
      })
    });
    const latencyMs = Date.now() - startedAt;
    this.lastLatencyMs = latencyMs;
    this.lastCheckedAt = new Date().toISOString();
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`GEMINI_TEST_FAILED:${body.slice(0, 200)}`);
    }
    const body = (await res.json()) as { text?: string };
    const text = String(body.text ?? "").trim();
    if (!text) {
      return { ok: false, text: "", latencyMs, message: "Empty response from Gemini" };
    }
    return { ok: true, text: text.slice(0, 280), latencyMs };
  }

  async init(auth: GeminiInitAuth): Promise<GeminiInitResult> {
    await this.startWorker();
    const body =
      auth.authMode === "browser"
        ? { authMode: "browser" }
        : {
            authMode: "cookies",
            secure1PSID: auth.secure1PSID,
            secure1PSIDTS: auth.secure1PSIDTS
          };
    const res = await this.worker.request("/v1/init", {
      method: "POST",
      body: JSON.stringify(body)
    });
    const text = await res.text();
    if (!res.ok) {
      this.ready = false;
      this.lastError = text;
      if (text.toLowerCase().includes("not installed")) {
        this.dependencyInstalled = false;
        throw new Error("GEMINI_DEPENDENCY_MISSING");
      }
      if (mapPhaseFromMessage(text, false) === "REAUTH_REQUIRED") {
        throw new Error("GEMINI_REAUTH_REQUIRED");
      }
      throw new Error(`GEMINI_INIT_FAILED:${text}`);
    }
    let parsed: any = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = {};
    }
    this.ready = true;
    this.dependencyInstalled = true;
    this.lastError = undefined;
    return { ok: true, cookies: parsed.cookies };
  }

  /** Convenience: start worker + browser auth (opens system browser flow — no password in app UI). */
  async start(): Promise<void> {
    await this.init({ authMode: "browser" });
  }

  async stop(): Promise<void> {
    try {
      if (this.lifecycle === "RUNNING") {
        await this.worker.request("/v1/shutdown-client", { method: "POST", body: "{}" }).catch(() => undefined);
      }
    } finally {
      await this.worker.stop();
      this.lifecycle = "STOPPED";
      this.ready = false;
      this.lastError = undefined;
    }
  }

  async health(): Promise<RuntimeHealth> {
    const detail = await this.detailedHealth();
    return {
      component: detail.component,
      status: detail.status,
      message: detail.message,
      latencyMs: detail.latencyMs,
      checkedAt: detail.checkedAt
    };
  }

  async detailedHealth(): Promise<{
    component: string;
    status: RuntimeHealth["status"];
    message?: string;
    latencyMs?: number;
    checkedAt: string;
    phase: GeminiConnectionPhase;
    account: GeminiAccountStatus;
    worker: GeminiWorkerLifecycle;
    dependencyInstalled?: boolean;
    model?: string;
  }> {
    const startedAt = Date.now();
    const checkedAt = new Date().toISOString();
    this.lastCheckedAt = checkedAt;

    if (this.lifecycle === "STARTING") {
      return {
        component: "llm:gemini-web",
        status: "DEGRADED",
        message: "Starting Gemini worker",
        checkedAt,
        phase: "STARTING",
        account: "UNKNOWN",
        worker: "STARTING",
        model: this.selectedModel
      };
    }

    if (this.lifecycle !== "RUNNING") {
      return {
        component: "llm:gemini-web",
        status: "DISABLED",
        message: this.lastError ?? "Gemini worker disconnected",
        checkedAt,
        phase: "DISCONNECTED",
        account: this.lastError ? "UNKNOWN" : "NOT_SIGNED_IN",
        worker: this.lifecycle,
        dependencyInstalled: this.dependencyInstalled,
        model: this.selectedModel
      };
    }

    try {
      const res = await this.worker.request("/health", { method: "GET" });
      const body = (await res.json()) as any;
      const latencyMs = Date.now() - startedAt;
      this.lastLatencyMs = latencyMs;
      this.dependencyInstalled = Boolean(body.dependencyInstalled);
      this.ready = Boolean(res.ok && body.ready);

      let phase: GeminiConnectionPhase =
        (body.phase as GeminiConnectionPhase | undefined)
        ?? mapPhaseFromMessage(String(body.message ?? ""), this.ready, this.dependencyInstalled);

      if (this.ready && latencyMs >= 5000) phase = "SLOW";

      const account: GeminiAccountStatus = this.ready
        ? "SIGNED_IN"
        : phase === "REAUTH_REQUIRED"
          ? "EXPIRED"
          : "NOT_SIGNED_IN";

      let status: RuntimeHealth["status"] = "DOWN";
      if (this.ready && phase === "READY") status = "OK";
      else if (this.ready && phase === "SLOW") status = "DEGRADED";
      else if (phase === "QUOTA_EXCEEDED" || phase === "REAUTH_REQUIRED") status = "DEGRADED";
      else if (this.dependencyInstalled === false) status = "DOWN";
      else status = "DEGRADED";

      return {
        component: "llm:gemini-web",
        status,
        message: body.message ?? "Gemini worker",
        latencyMs,
        checkedAt,
        phase,
        account,
        worker: "RUNNING",
        dependencyInstalled: this.dependencyInstalled,
        model: this.selectedModel
      };
    } catch (error) {
      this.ready = false;
      this.lastError = String(error);
      return {
        component: "llm:gemini-web",
        status: "DOWN",
        message: String(error),
        checkedAt,
        phase: "CONNECTOR_ERROR",
        account: "UNKNOWN",
        worker: "ERROR",
        dependencyInstalled: this.dependencyInstalled,
        model: this.selectedModel
      };
    }
  }

  async listModels(): Promise<string[]> {
    if (this.lifecycle !== "RUNNING" || !this.ready) return [];
    const res = await this.worker.request("/v1/models", { method: "GET" });
    if (!res.ok) return [];
    const body = (await res.json()) as any;
    return Array.isArray(body.models) ? body.models.map((m: any) => String(m.name ?? m)) : [];
  }

  async generateActionProposal(context: LlmContext): Promise<ActionProposal> {
    if (this.lifecycle !== "RUNNING" || !this.ready) {
      throw new Error("GEMINI_NOT_CONNECTED");
    }

    let lastFailure: { code: "INVALID_JSON" | "SCHEMA" | "HALLUCINATION"; error: string } | undefined;

    for (let attempt = 1; attempt <= SALES_BRAIN_MAX_ATTEMPTS; attempt += 1) {
      const prompt = buildSalesBrainPrompt(context, {
        retryHint: lastFailure ? `${lastFailure.code}: ${lastFailure.error}` : undefined
      });
      const rawText = await this.generateRawText(prompt);
      const parsed = parseAndValidateSalesBrainOutput(rawText, context);
      if (parsed.ok) {
        return {
          ...parsed.proposal,
          metadata: {
            ...(parsed.proposal.metadata ?? {}),
            provider: "gemini-web",
            model: this.selectedModel,
            latencyMs: this.lastLatencyMs,
            attempt
          }
        };
      }

      lastFailure = { code: parsed.code, error: parsed.error };
      // Invalid / hallucinated output must not execute — retry then ASK_OPERATOR.
    }

    return askOperatorFromSalesBrainFailure(
      context,
      lastFailure ?? { code: "INVALID_JSON", error: "unknown sales brain failure" }
    );
  }

  private async generateRawText(prompt: string): Promise<string> {
    const startedAt = Date.now();
    const res = await this.worker.request("/v1/generate", {
      method: "POST",
      body: JSON.stringify({
        prompt,
        model: this.selectedModel,
        temporary: true
      })
    });
    this.lastLatencyMs = Date.now() - startedAt;
    this.lastCheckedAt = new Date().toISOString();

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429 || /quota|rate limit/i.test(body)) {
        throw new Error(`GEMINI_QUOTA_EXCEEDED:${body}`);
      }
      if (res.status === 401 || /auth|cookie|login/i.test(body)) {
        this.ready = false;
        throw new Error(`GEMINI_REAUTH_REQUIRED:${body}`);
      }
      throw new Error(`GEMINI_GENERATION_FAILED:${body}`);
    }
    const body = (await res.json()) as { text?: string; model?: string };
    return String(body.text ?? "");
  }
}
