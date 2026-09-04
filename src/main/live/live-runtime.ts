import type {
  ApprovalItem,
  AutomationMode,
  LiveEvent,
  ProductDNA,
  RuntimeHealth,
  TikTokAccount
} from "../../shared/live-types";
import type { LlmProvider } from "../connectors/llm/types";
import type { MediaProvider } from "../connectors/media/types";
import { LiveEventBus } from "../core/event-bus";
import type {
  AccountLiveSettingsRepository,
  ApprovalRepository,
  LiveEventRepository,
  LiveSessionRepository,
  ProductRepository
} from "../db/repositories";
import { LiveOrchestrator } from "./live-orchestrator";
import { DEFAULT_ACCOUNT_AUTOMATION_MODE } from "../../shared/tiktok-account";

export type LiveRuntimeRepositories = {
  products: ProductRepository;
  events: LiveEventRepository;
  approvals: ApprovalRepository;
  sessions: LiveSessionRepository;
  accountLiveSettings: AccountLiveSettingsRepository;
};

export type LiveRuntimeDeps = {
  account: TikTokAccount;
  llm: LlmProvider;
  media: MediaProvider;
  repositories: LiveRuntimeRepositories;
  /** Optional override — defaults to a fresh isolated bus. */
  eventBus?: LiveEventBus;
  /** Extra side-effects (e.g. CommentFeed) — provenance already stamped. */
  onApprovalChanged?: (item: ApprovalItem) => void;
};

/**
 * Per-TikTok-account live runtime.
 * Owns its own EventBus + LiveOrchestrator (+ memory/approvals inside).
 * Shares LLM base provider, product catalog DB, and SQLite connection via repos.
 */
export class LiveRuntime {
  readonly account: TikTokAccount;
  readonly eventBus: LiveEventBus;
  private readonly products: ProductRepository;
  private readonly events: LiveEventRepository;
  private readonly approvalsRepo: ApprovalRepository;
  private readonly sessions: LiveSessionRepository;
  private readonly settings: AccountLiveSettingsRepository;
  private readonly media: MediaProvider;
  private readonly orchestrator: LiveOrchestrator;
  private readonly onApprovalChanged?: (item: ApprovalItem) => void;
  private disposed = false;
  private productId?: string;
  private lastHealth: RuntimeHealth;

  constructor(deps: LiveRuntimeDeps) {
    this.account = deps.account;
    this.eventBus = deps.eventBus ?? new LiveEventBus();
    this.products = deps.repositories.products;
    this.events = deps.repositories.events;
    this.approvalsRepo = deps.repositories.approvals;
    this.sessions = deps.repositories.sessions;
    this.settings = deps.repositories.accountLiveSettings;
    this.media = deps.media;
    this.onApprovalChanged = deps.onApprovalChanged;

    const ensured = this.settings.ensure(this.account.id);
    this.productId = ensured.currentProductId;

    this.lastHealth = {
      component: `live-runtime:${this.account.id}`,
      status: "DISABLED",
      message: "idle",
      checkedAt: new Date().toISOString()
    };

    this.orchestrator = new LiveOrchestrator({
      eventBus: this.eventBus,
      llm: deps.llm,
      media: deps.media,
      getCurrentProduct: () => this.resolveCurrentProduct(),
      onApprovalChanged: (item) => this.persistApproval(item),
      onSessionStart: (sessionId, mode) => {
        this.sessions.startWithId(sessionId, mode, this.account.id);
        this.touchHealth("OK", "live");
      },
      onSessionEnd: (sessionId, finalState) => {
        this.sessions.end(sessionId, finalState);
        this.touchHealth("DISABLED", "stopped");
      }
    });

    this.orchestrator.setMode(ensured.automationMode);
  }

  get accountId(): string {
    return this.account.id;
  }

  get isRunning(): boolean {
    return this.orchestrator.isRunning;
  }

  get sessionId(): string | undefined {
    return this.orchestrator.sessionId;
  }

  get state(): string {
    return this.orchestrator.state;
  }

  get automationMode(): AutomationMode {
    return this.orchestrator.automationMode;
  }

  get currentProductId(): string | undefined {
    if (this.productId && this.products.get(this.productId)) return this.productId;
    return undefined;
  }

  getMemorySnapshot() {
    return this.orchestrator.getMemorySnapshot();
  }

  health(): RuntimeHealth {
    return {
      ...this.lastHealth,
      checkedAt: new Date().toISOString(),
      status: this.disposed ? "DOWN" : this.isRunning ? "OK" : this.lastHealth.status,
      message: this.disposed ? "disposed" : this.isRunning ? "live" : this.lastHealth.message
    };
  }

  setCurrentProduct(id: string | undefined): void {
    this.assertNotDisposed();
    if (id && !this.products.get(id)) throw new Error("PRODUCT_NOT_FOUND");
    this.productId = id;
    this.settings.upsert({
      accountId: this.account.id,
      currentProductId: id
    });
  }

  setAutomationMode(mode: AutomationMode): void {
    this.assertNotDisposed();
    this.orchestrator.setMode(mode);
    this.settings.upsert({
      accountId: this.account.id,
      automationMode: mode
    });
  }

  /** @deprecated Prefer setAutomationMode — kept for IPC parity with LiveOrchestrator. */
  setMode(mode: AutomationMode): void {
    this.setAutomationMode(mode);
  }

  start(): void {
    this.assertNotDisposed();
    if (this.isRunning) return;
    if (this.sessions.hasActiveSession(this.account.id)) {
      throw new Error("ACCOUNT_LIVE_ACTIVE");
    }
    this.orchestrator.start();
  }

  stop(): void {
    if (this.disposed) return;
    this.orchestrator.stop();
  }

  /**
   * Only path for external events into this runtime's bus.
   * Rejects foreign accountId; stamps active sessionId when live.
   */
  publishEvent(event: LiveEvent): void {
    this.assertNotDisposed();
    if (event.accountId !== this.accountId) {
      console.error(
        `[LiveRuntime ${this.accountId}] rejected foreign event`,
        event.id,
        event.accountId
      );
      throw new Error("EVENT_ACCOUNT_MISMATCH");
    }

    const stamped: LiveEvent = {
      ...event,
      accountId: this.accountId,
      sessionId: event.sessionId ?? (this.isRunning ? this.sessionId : undefined)
    };

    this.events.save(stamped.sessionId ?? null, stamped);
    this.eventBus.publish(stamped);
  }

  listApprovals(): ApprovalItem[] {
    return this.orchestrator.listApprovals().map((item) => this.stampApproval(item));
  }

  async resolveApproval(
    id: string,
    decision: "approve" | "reject",
    editedSpeech?: string
  ): Promise<void> {
    this.assertNotDisposed();
    await this.orchestrator.resolveApproval(id, decision, editedSpeech);
  }

  cancelAutoApproval(id: string): ApprovalItem {
    return this.orchestrator.cancelAutoApproval(id);
  }

  cancelNearestAutoApproval(): ApprovalItem | undefined {
    return this.orchestrator.cancelNearestAutoApproval();
  }

  stopAutomation(): void {
    this.orchestrator.stopAutomation();
    this.settings.upsert({
      accountId: this.account.id,
      automationMode: this.orchestrator.automationMode
    });
  }

  get supervisedDelayMs(): number {
    return this.orchestrator.supervisedDelayMs;
  }

  dispose(): void {
    if (this.disposed) return;
    this.stop();
    void this.media.stopSpeech().catch(() => undefined);
    this.disposed = true;
    this.touchHealth("DOWN", "disposed");
  }

  private resolveCurrentProduct(): ProductDNA | undefined {
    const id = this.currentProductId;
    return id ? this.products.get(id) : undefined;
  }

  private stampApproval(item: ApprovalItem): ApprovalItem {
    return {
      ...item,
      accountId: this.accountId,
      sessionId: item.sessionId ?? this.sessionId
    };
  }

  private persistApproval(item: ApprovalItem): void {
    const stamped = this.stampApproval(item);
    // Active live must persist with real session id — never null.
    if (this.isRunning && !stamped.sessionId) {
      throw new Error("APPROVAL_SESSION_REQUIRED");
    }
    this.approvalsRepo.save(stamped.sessionId ?? null, stamped);
    this.onApprovalChanged?.(stamped);
  }

  private touchHealth(status: RuntimeHealth["status"], message: string): void {
    this.lastHealth = {
      component: `live-runtime:${this.account.id}`,
      status,
      message,
      checkedAt: new Date().toISOString()
    };
  }

  private assertNotDisposed(): void {
    if (this.disposed) throw new Error("LIVE_RUNTIME_DISPOSED");
  }
}

/** Default mode for brand-new account settings (re-export convenience). */
export { DEFAULT_ACCOUNT_AUTOMATION_MODE };
