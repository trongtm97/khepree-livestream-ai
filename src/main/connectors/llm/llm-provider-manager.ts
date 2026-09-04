import { randomUUID } from "node:crypto";
import type {
  GeminiConnectionPhase,
  GeminiProbeResult,
  GeminiPublicState,
  GeminiTestResult,
  LlmProviderId
} from "../../../shared/gemini-contracts";
import { toGeminiError } from "../../../shared/gemini-errors";
import type { AppLocale } from "../../../shared/locale";
import type { ActionProposal, RuntimeHealth } from "../../../shared/live-types";
import { CircuitBreaker } from "./circuit-breaker";
import { FallbackSalesProvider } from "./fallback-sales-provider";
import { GeminiSessionStore } from "./gemini-session-store";
import { GeminiWorkerProvider } from "./gemini-worker-provider";
import { MockLlmProvider } from "./mock-llm-provider";
import type { LlmContext, LlmProvider } from "./types";

export const FALLBACK_SCRIPT_OPERATOR_MESSAGE_VI =
  "Gemini đang tạm thời không khả dụng. Phần mềm đang sử dụng kịch bản dự phòng.";
export const FALLBACK_SCRIPT_OPERATOR_MESSAGE_EN =
  "Gemini is temporarily unavailable. The app is using the backup sales script.";

export interface LlmProviderManagerOptions {
  appRoot: string;
  pythonExecutable?: string;
  startupTimeoutMs?: number;
  getPreferredProvider: () => LlmProviderId;
  setPreferredProvider: (id: LlmProviderId) => void;
  getDemoAcknowledged: () => boolean;
  setDemoAcknowledged: (value: boolean) => void;
  getSelectedModel: () => string | undefined;
  setSelectedModel: (model: string | undefined) => void;
  getLocale: () => AppLocale;
}

/**
 * Routes sales-brain calls to mock, gemini-web, or config-driven FallbackSalesProvider.
 * Never silently fakes Gemini with mock unless preferred=mock or demo is acknowledged.
 * When Gemini is preferred but down, ScriptBrain keeps the livestream moving — UI must say so.
 */
export class LlmProviderManager implements LlmProvider {
  readonly mock = new MockLlmProvider();
  readonly gemini: GeminiWorkerProvider;
  readonly fallback: FallbackSalesProvider;
  readonly session = new GeminiSessionStore();
  private readonly circuit = new CircuitBreaker(3, 60_000);
  private modelsCache: string[] = [];
  private lastPublic?: GeminiPublicState;
  private usingFallbackScript = false;

  constructor(private readonly opts: LlmProviderManagerOptions) {
    this.gemini = new GeminiWorkerProvider(
      opts.appRoot,
      opts.pythonExecutable ?? process.env.KHEPREE_PYTHON ?? "python",
      opts.startupTimeoutMs
        ?? Number(process.env.KHEPREE_WORKER_STARTUP_TIMEOUT_MS ?? 20000)
    );
    this.fallback = new FallbackSalesProvider({
      appRoot: opts.appRoot,
      getLocale: () => opts.getLocale()
    });
    const savedModel = opts.getSelectedModel();
    if (savedModel) this.gemini.setSelectedModel(savedModel);
  }

  get preferredProvider(): LlmProviderId {
    return this.opts.getPreferredProvider();
  }

  get activeProviderId(): LlmProviderId {
    if (this.preferredProvider === "gemini-web" && this.gemini.isReady() && !this.circuit.isOpen) {
      return "gemini-web";
    }
    if (this.preferredProvider === "mock" || this.opts.getDemoAcknowledged()) {
      return "mock";
    }
    // Preferred gemini but not usable — still report gemini-web as intended active target
    // for UI honesty; generate will not silent-mock.
    return this.preferredProvider === "gemini-web" ? "gemini-web" : "mock";
  }

  async setPreferredProvider(id: LlmProviderId): Promise<void> {
    this.opts.setPreferredProvider(id);
    if (id === "mock") {
      this.opts.setDemoAcknowledged(true);
    }
  }

  acknowledgeDemoMode(): void {
    this.opts.setDemoAcknowledged(true);
    this.opts.setPreferredProvider("mock");
  }

  async setModel(model: string | undefined): Promise<void> {
    this.gemini.setSelectedModel(model);
    this.opts.setSelectedModel(model);
  }

  async connect(): Promise<GeminiPublicState> {
    this.circuit.reset();
    const cookies = this.safeLoadCookies();
    try {
      const result = cookies
        ? await this.gemini.init({
            authMode: "cookies",
            secure1PSID: cookies.secure1PSID,
            secure1PSIDTS: cookies.secure1PSIDTS
          })
        : await this.gemini.init({ authMode: "browser" });
      this.persistCookiesFromInit(result.cookies);
      this.opts.setPreferredProvider("gemini-web");
      this.opts.setDemoAcknowledged(false);
      this.usingFallbackScript = false;
      this.modelsCache = await this.gemini.listModels().catch(() => []);
      if (!this.gemini.getSelectedModel() && this.modelsCache[0]) {
        await this.setModel(this.modelsCache[0]);
      }
    } catch (error) {
      if (cookies && String(error).includes("REAUTH")) {
        this.session.clear();
      }
      throw toGeminiError(error);
    }
    return this.getPublicState();
  }

  async reauth(): Promise<GeminiPublicState> {
    this.session.clear();
    this.circuit.reset();
    try {
      if (this.gemini.getWorkerLifecycle() === "RUNNING") {
        await this.gemini.stop();
      }
      const result = await this.gemini.init({ authMode: "browser" });
      this.persistCookiesFromInit(result.cookies);
      this.opts.setPreferredProvider("gemini-web");
      this.opts.setDemoAcknowledged(false);
      this.modelsCache = await this.gemini.listModels().catch(() => []);
    } catch (error) {
      throw toGeminiError(error);
    }
    return this.getPublicState();
  }

  async probe(): Promise<GeminiProbeResult> {
    const result = await this.gemini.probe();
    if (!result.workerOk) {
      const code = mapProbeGuide(result.message);
      return {
        workerOk: false,
        dependencyInstalled: false,
        message: result.message,
        guideCode: code
      };
    }
    if (!result.dependencyInstalled) {
      return {
        workerOk: true,
        dependencyInstalled: false,
        message: result.message,
        guideCode: "DEPENDENCY_MISSING"
      };
    }
    return {
      workerOk: true,
      dependencyInstalled: true,
      message: result.message,
      guideCode: "OK"
    };
  }

  async testConnection(prompt?: string): Promise<GeminiTestResult> {
    try {
      const result = await this.gemini.runSmokeTest(prompt);
      if (!result.ok) {
        return {
          ok: false,
          text: result.text,
          latencyMs: result.latencyMs,
          message: result.message ?? "GEMINI_TEST_FAILED"
        };
      }
      this.circuit.recordSuccess();
      return result;
    } catch (error) {
      this.circuit.recordFailure();
      throw toGeminiError(error);
    }
  }

  /** Advanced settings only — store encrypted session tokens in main, never renderer-readable later. */
  async saveManualSession(secure1PSID: string, secure1PSIDTS?: string): Promise<GeminiPublicState> {
    const psid = secure1PSID.trim();
    if (!psid) throw new Error("GEMINI_SESSION_REQUIRED");
    try {
      this.session.save(psid, secure1PSIDTS?.trim() || undefined);
    } catch (error) {
      throw toGeminiError(error);
    }
    return this.connect();
  }

  async clearManualSession(): Promise<GeminiPublicState> {
    this.session.clear();
    return this.getPublicState();
  }

  async disconnect(): Promise<GeminiPublicState> {
    await this.gemini.stop();
    return this.getPublicState();
  }

  async health(): Promise<RuntimeHealth> {
    const state = await this.refreshPublicState();
    if (state.usingFallbackScript || state.phase === "FALLBACK_SCRIPT") {
      const script = await this.fallback.health();
      return {
        ...script,
        status: "DEGRADED",
        message: this.fallbackOperatorMessage()
      };
    }
    if (state.activeProvider === "mock" || state.phase === "DEMO") {
      const mock = await this.mock.health();
      return {
        ...mock,
        component: "llm:mock",
        status: "OK",
        message: "DEMO mock provider — not production Gemini"
      };
    }
    if (state.circuitOpen) {
      return {
        component: "llm:gemini-web",
        status: "DEGRADED",
        message: state.message ?? "Circuit open after repeated Gemini failures",
        latencyMs: state.latencyMs,
        checkedAt: state.lastCheckedAt ?? new Date().toISOString()
      };
    }
    return {
      component: "llm:gemini-web",
      status:
        state.phase === "READY"
          ? "OK"
          : state.phase === "DISCONNECTED"
            ? "DISABLED"
            : state.phase === "CONNECTOR_ERROR"
              ? "DOWN"
              : "DEGRADED",
      message: state.message,
      latencyMs: state.latencyMs,
      checkedAt: state.lastCheckedAt ?? new Date().toISOString()
    };
  }

  async listModels(): Promise<string[]> {
    if (this.gemini.isReady()) {
      this.modelsCache = await this.gemini.listModels();
      return this.modelsCache;
    }
    return this.modelsCache;
  }

  async generateActionProposal(context: LlmContext): Promise<ActionProposal> {
    const preferred = this.preferredProvider;

    if (preferred === "gemini-web") {
      if (this.circuit.isOpen) {
        return this.generateFallback(context, "circuit_open");
      }
      if (!this.gemini.isReady()) {
        if (this.opts.getDemoAcknowledged()) {
          this.usingFallbackScript = false;
          const proposal = await this.mock.generateActionProposal(context);
          return {
            ...proposal,
            reason: `DEMO mock (Gemini not connected): ${proposal.reason}`,
            riskTags: [...proposal.riskTags, "demo_mock"],
            metadata: { ...(proposal.metadata ?? {}), provider: "mock", demo: true }
          };
        }
        return this.generateFallback(context, "gemini_not_connected");
      }
      try {
        const proposal = await this.gemini.generateActionProposal(context);
        this.circuit.recordSuccess();
        this.usingFallbackScript = false;
        return proposal;
      } catch (error) {
        this.circuit.recordFailure();
        return this.generateFallback(context, String(error));
      }
    }

    this.usingFallbackScript = false;
    const proposal = await this.mock.generateActionProposal(context);
    return {
      ...proposal,
      reason: `Mock/demo provider: ${proposal.reason}`,
      riskTags: [...new Set([...proposal.riskTags, "demo_mock"])],
      metadata: { ...(proposal.metadata ?? {}), provider: "mock", demo: true }
    };
  }

  private async generateFallback(
    context: LlmContext,
    cause: string
  ): Promise<ActionProposal> {
    this.usingFallbackScript = true;
    const proposal = await this.fallback.generateActionProposal(context);
    return {
      ...proposal,
      reason: `${proposal.reason} Cause: ${cause}`,
      riskTags: [...new Set([...proposal.riskTags, "fallback_script"])],
      metadata: {
        ...(proposal.metadata ?? {}),
        provider: "fallback-script",
        geminiUnavailable: true,
        cause
      }
    };
  }

  private fallbackOperatorMessage(): string {
    return this.opts.getLocale() === "en"
      ? FALLBACK_SCRIPT_OPERATOR_MESSAGE_EN
      : FALLBACK_SCRIPT_OPERATOR_MESSAGE_VI;
  }

  async getPublicState(): Promise<GeminiPublicState> {
    return this.refreshPublicState();
  }

  async dispose(): Promise<void> {
    await this.gemini.stop().catch(() => undefined);
  }

  private async refreshPublicState(): Promise<GeminiPublicState> {
    const preferred = this.preferredProvider;
    const demo = this.opts.getDemoAcknowledged();
    const detail = await this.gemini.detailedHealth();
    const circuitOpen = this.circuit.isOpen;

    let phase: GeminiConnectionPhase = detail.phase;
    let active: LlmProviderId = preferred;
    let message = detail.message;
    const geminiUsable = this.gemini.isReady() && !circuitOpen;

    if (preferred === "mock" || (demo && !this.gemini.isReady())) {
      phase = "DEMO";
      active = "mock";
      this.usingFallbackScript = false;
    } else if (preferred === "gemini-web") {
      active = "gemini-web";
      if (!geminiUsable || this.usingFallbackScript) {
        phase = "FALLBACK_SCRIPT";
        message = this.fallbackOperatorMessage();
        if (!this.usingFallbackScript && (circuitOpen || !this.gemini.isReady())) {
          this.usingFallbackScript = true;
        }
      } else {
        phase = detail.phase;
      }
    }

    if (this.gemini.isReady() && this.modelsCache.length === 0) {
      this.modelsCache = await this.gemini.listModels().catch(() => []);
    }

    this.lastPublic = {
      preferredProvider: preferred,
      activeProvider: active,
      demoModeAcknowledged: demo,
      phase,
      worker: detail.worker,
      account: detail.account,
      model: this.gemini.getSelectedModel() ?? detail.model,
      models: this.modelsCache,
      latencyMs: detail.latencyMs ?? this.gemini.getLastLatencyMs(),
      lastCheckedAt: detail.checkedAt ?? this.gemini.getLastCheckedAt(),
      message:
        phase === "FALLBACK_SCRIPT"
          ? this.fallbackOperatorMessage()
          : circuitOpen
            ? `Circuit open — pause Gemini calls (~${Math.ceil(this.circuit.remainingMs / 1000)}s)`
            : message,
      circuitOpen,
      dependencyInstalled: detail.dependencyInstalled,
      hasEncryptedSession: this.session.hasSession(),
      usingFallbackScript: phase === "FALLBACK_SCRIPT" || this.usingFallbackScript
    };
    return this.lastPublic;
  }

  private safeLoadCookies(): { secure1PSID: string; secure1PSIDTS?: string } | undefined {
    try {
      return this.session.load();
    } catch {
      return undefined;
    }
  }

  private persistCookiesFromInit(
    cookies?: { secure1PSID?: string | null; secure1PSIDTS?: string | null }
  ): void {
    const psid = cookies?.secure1PSID?.trim();
    if (!psid) return;
    try {
      this.session.save(psid, cookies?.secure1PSIDTS?.trim() || undefined);
    } catch {
      // safeStorage unavailable — session stays in-process only
    }
  }
}

function mapProbeGuide(message: string): GeminiProbeResult["guideCode"] {
  const lower = message.toLowerCase();
  if (lower.includes("script missing")) return "WORKER_SCRIPT_MISSING";
  if (lower.includes("timeout")) return "WORKER_TIMEOUT";
  if (lower.includes("python") || lower.includes("spawn") || lower.includes("enoent")) {
    return "PYTHON_MISSING";
  }
  return "WORKER_ERROR";
}

// ponytail: self-check; upgrade when suite exists
export function assertLlmProviderManagerContract(): void {
  const breaker = new CircuitBreaker(2, 1000);
  if (breaker.isOpen) throw new Error("circuit should start closed");
  breaker.recordFailure();
  breaker.recordFailure();
  if (!breaker.isOpen) throw new Error("circuit should open after threshold");
  const mock = new MockLlmProvider();
  if (!mock) throw new Error("mock provider missing");
  if (mapProbeGuide("Worker script missing: x") !== "WORKER_SCRIPT_MISSING") {
    throw new Error("probe guide map failed");
  }
  if (!FALLBACK_SCRIPT_OPERATOR_MESSAGE_VI.includes("kịch bản dự phòng")) {
    throw new Error("fallback operator message drifted");
  }
}
