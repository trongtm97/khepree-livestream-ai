import type {
  AccountLiveSnapshot,
  ApprovalItem,
  AutomationMode,
  LiveEvent,
  TikTokAccount
} from "../../shared/live-types";
import { DEFAULT_ACCOUNT_AUTOMATION_MODE } from "../../shared/tiktok-account";
import type { LlmProvider } from "../connectors/llm/types";
import type { MediaSession } from "../connectors/media/types";
import { MockMediaProvider } from "../connectors/media/mock-media-provider";
import { OperatorControlService } from "./operator-control-service";
import type { OperatorControlPublicSnapshot } from "../../shared/operator-control";
import type { OperatorControlMode } from "../../shared/operator-control";
import type {
  AccountLiveSettingsRepository,
  TikTokAccountRepository
} from "../db/repositories";
import {
  LiveRuntime,
  type LiveRuntimeRepositories
} from "./live-runtime";
import type { LiveCapacityService } from "./live-capacity-service";
import {
  LIVE_BATCH_REASONS,
  isCapacityOrLicenseReason,
  normalizeBatchErrorCode,
  type LiveStartReadyBatchResult,
  type LiveStopAllBatchResult
} from "../../shared/live-batch";

export type MultiLiveRuntimeManagerDeps = {
  accounts: TikTokAccountRepository;
  accountLiveSettings: AccountLiveSettingsRepository;
  repositories: LiveRuntimeRepositories;
  llm: LlmProvider;
  /** Khepree entitlement gate (fail-closed in production). */
  assertProductAccess: (feature?: string) => void;
  /**
   * License + hardware capacity (authoritative for startLive).
   * Required — do not fall back to Infinity.
   */
  capacity: LiveCapacityService;
  /**
   * Called when assertReadyToStart reserved resources but runtime.start() failed —
   * release avatar GPU holds without treating the account as a full stop.
   */
  onReadyStartFailed?: (accountId: string) => void;
  /** Optional live resource counters (workers / browsers / AI queue). */
  getResourceExtras?: () => {
    activeTikTokWorkers: number;
    activeBrowserContexts: number;
    aiQueueLength: number;
  };
  /** Factory so each runtime owns a MediaSession (accountId required). */
  createMedia?: (accountId: string) => MediaSession;
  /**
   * Extra readiness after account/entitlement/concurrency checks.
   * Throw to block start (e.g. missing product DNA).
   */
  assertReadyToStart?: (account: TikTokAccount, runtime: LiveRuntime) => void;
  onEvent?: (event: LiveEvent) => void;
  onApprovalChanged?: (item: ApprovalItem) => void;
  /** Bind AI scheduler session after live start (optional). */
  onLiveStarted?: (accountId: string, sessionId: string) => void;
  /** Cancel queued AI jobs when live stops (optional). */
  onLiveStopped?: (accountId: string) => void;
  /** Shared operator control (takeover / emergency). */
  operatorControl?: OperatorControlService;
  onOperatorControlChanged?: (accountId?: string) => void;
};

/**
 * Global registry of per-account LiveRuntime instances.
 * Map lookup only — never scan an array to route events.
 */
export class MultiLiveRuntimeManager {
  private readonly runtimes = new Map<string, LiveRuntime>();
  private readonly unsubs = new Map<string, () => void>();
  private focusedAccountId?: string;
  private disposed = false;

  constructor(private readonly deps: MultiLiveRuntimeManagerDeps) {}

  get focusedId(): string | undefined {
    return this.focusedAccountId;
  }

  /** Operator focus for UI / dev IPC shim — not an implicit startLive target in production. */
  setFocusedAccountId(accountId: string | undefined): void {
    if (accountId && !this.deps.accounts.get(accountId)) {
      throw new Error("TIKTOK_ACCOUNT_NOT_FOUND");
    }
    this.focusedAccountId = accountId;
  }

  listAccounts(): TikTokAccount[] {
    return this.deps.accounts.list();
  }

  listRuntimes(): LiveRuntime[] {
    return [...this.runtimes.values()];
  }

  getRuntime(accountId: string): LiveRuntime | undefined {
    return this.runtimes.get(accountId);
  }

  /** Create runtime if missing; refresh account row from DB. */
  ensureRuntime(accountId: string): LiveRuntime {
    this.assertNotDisposed();
    const existing = this.runtimes.get(accountId);
    if (existing) return existing;

    const account = this.deps.accounts.get(accountId);
    if (!account) throw new Error("TIKTOK_ACCOUNT_NOT_FOUND");

    const media = this.deps.createMedia?.(accountId) ?? new MockMediaProvider(accountId);
    const runtime = new LiveRuntime({
      account,
      llm: this.deps.llm,
      media,
      repositories: this.deps.repositories,
      onApprovalChanged: (item) => this.deps.onApprovalChanged?.(item)
    });

    const unsub = runtime.eventBus.subscribe((event) => {
      this.deps.onEvent?.(event);
    });
    this.unsubs.set(accountId, unsub);
    this.runtimes.set(accountId, runtime);
    return runtime;
  }

  startLive(accountId: string): LiveRuntime {
    this.assertNotDisposed();
    if (!accountId?.trim()) throw new Error("ACCOUNT_ID_REQUIRED");

    const account = this.deps.accounts.get(accountId);
    if (!account) throw new Error("TIKTOK_ACCOUNT_NOT_FOUND");
    if (!account.enabled) throw new Error("ACCOUNT_DISABLED");

    const existingRt = this.runtimes.get(accountId);
    if (existingRt?.isRunning) throw new Error("ACCOUNT_LIVE_ACTIVE");
    if (this.deps.repositories.sessions.hasActiveSession(accountId)) {
      throw new Error("ACCOUNT_LIVE_ACTIVE");
    }

    this.deps.assertProductAccess();

    const extras = this.deps.getResourceExtras?.() ?? {
      activeTikTokWorkers: 0,
      activeBrowserContexts: 0,
      aiQueueLength: 0
    };
    this.deps.capacity.assertCanStartLive({
      activeRuntimes: this.countRunning(),
      activeTikTokWorkers: extras.activeTikTokWorkers,
      activeBrowserContexts: extras.activeBrowserContexts,
      aiQueueLength: extras.aiQueueLength,
      accountCount: this.deps.accounts.list().length
    });

    const runtime = this.ensureRuntime(accountId);

    const settings = this.deps.accountLiveSettings.ensure(accountId);
    if (!settings.enabled) throw new Error("ACCOUNT_SETTINGS_DISABLED");

    this.deps.assertReadyToStart?.(account, runtime);

    try {
      runtime.start();
    } catch (error) {
      this.deps.onReadyStartFailed?.(accountId);
      throw error;
    }
    const sessionId = runtime.sessionId;
    if (sessionId) this.deps.onLiveStarted?.(accountId, sessionId);
    return runtime;
  }

  /** Preflight for UI — does not start. */
  canStartLive(accountId: string) {
    const account = this.deps.accounts.get(accountId);
    if (!account) throw new Error("TIKTOK_ACCOUNT_NOT_FOUND");
    const extras = this.deps.getResourceExtras?.() ?? {
      activeTikTokWorkers: 0,
      activeBrowserContexts: 0,
      aiQueueLength: 0
    };
    const already = this.runtimes.get(accountId)?.isRunning === true;
    return this.deps.capacity.canStartLive({
      activeRuntimes: this.countRunning(),
      activeTikTokWorkers: extras.activeTikTokWorkers,
      activeBrowserContexts: extras.activeBrowserContexts,
      aiQueueLength: extras.aiQueueLength,
      accountCount: this.deps.accounts.list().length,
      accountAlreadyLive: already
    });
  }

  stopLive(accountId: string): void {
    const runtime = this.runtimes.get(accountId);
    if (!runtime) return;
    runtime.stop();
    this.deps.onLiveStopped?.(accountId);
  }

  /**
   * Start every ready account. Per-account catch — one failure never aborts the rest.
   * Capacity is re-checked inside each startLive (dynamic after each success).
   */
  startReadyLives(opts?: {
    isTikTokConnected?: (accountId: string) => boolean;
  }): LiveStartReadyBatchResult {
    this.assertNotDisposed();
    const started: LiveStartReadyBatchResult["started"] = [];
    const skipped: LiveStartReadyBatchResult["skipped"] = [];
    const failed: LiveStartReadyBatchResult["failed"] = [];
    const accounts = this.listAccounts();

    for (const account of accounts) {
      const accountId = account.id;

      if (this.runtimes.get(accountId)?.isRunning) {
        skipped.push({ accountId, reasonCode: LIVE_BATCH_REASONS.ALREADY_RUNNING });
        continue;
      }
      if (!account.enabled) {
        skipped.push({ accountId, reasonCode: LIVE_BATCH_REASONS.ACCOUNT_DISABLED });
        continue;
      }

      const settings = this.deps.accountLiveSettings.ensure(accountId);
      if (!settings.enabled) {
        skipped.push({ accountId, reasonCode: LIVE_BATCH_REASONS.ACCOUNT_SETTINGS_DISABLED });
        continue;
      }

      const productId =
        this.runtimes.get(accountId)?.currentProductId ?? settings.currentProductId;
      if (!productId) {
        skipped.push({ accountId, reasonCode: LIVE_BATCH_REASONS.NO_PRODUCT });
        continue;
      }

      if (opts?.isTikTokConnected && !opts.isTikTokConnected(accountId)) {
        skipped.push({ accountId, reasonCode: LIVE_BATCH_REASONS.TIKTOK_DISCONNECTED });
        continue;
      }

      try {
        this.startLive(accountId);
        started.push({ accountId });
      } catch (error) {
        const reasonCode = normalizeBatchErrorCode(error);
        if (isCapacityOrLicenseReason(reasonCode)) {
          skipped.push({ accountId, reasonCode: LIVE_BATCH_REASONS.CAPACITY_LIMIT });
        } else if (
          reasonCode === LIVE_BATCH_REASONS.AUDIO_ROUTING_NOT_READY ||
          reasonCode === LIVE_BATCH_REASONS.OUTPUT_MODE_NOT_READY ||
          reasonCode.startsWith("OUTPUT_MODE_NOT_READY")
        ) {
          skipped.push({
            accountId,
            reasonCode: reasonCode.startsWith("OUTPUT_MODE_NOT_READY")
              ? LIVE_BATCH_REASONS.OUTPUT_MODE_NOT_READY
              : LIVE_BATCH_REASONS.AUDIO_ROUTING_NOT_READY
          });
        } else {
          failed.push({ accountId, reasonCode });
        }
      }
    }

    return {
      attempted: accounts.length,
      started,
      skipped,
      failed
    };
  }

  /** Stop all running AI lives — does not disconnect TikTok or close browsers. */
  stopAll(): LiveStopAllBatchResult {
    const stopped: LiveStopAllBatchResult["stopped"] = [];
    const skipped: LiveStopAllBatchResult["skipped"] = [];
    const failed: LiveStopAllBatchResult["failed"] = [];
    const accounts = this.listAccounts();
    let attempted = 0;

    for (const account of accounts) {
      const accountId = account.id;
      if (!this.runtimes.get(accountId)?.isRunning) {
        skipped.push({ accountId, reasonCode: "NOT_RUNNING" });
        continue;
      }
      attempted += 1;
      try {
        this.stopLive(accountId);
        stopped.push({ accountId });
      } catch (error) {
        failed.push({ accountId, reasonCode: normalizeBatchErrorCode(error) });
      }
    }

    return { attempted, stopped, skipped, failed };
  }

  disposeAccount(accountId: string): void {
    const runtime = this.runtimes.get(accountId);
    if (!runtime) return;
    this.unsubs.get(accountId)?.();
    this.unsubs.delete(accountId);
    runtime.dispose();
    this.runtimes.delete(accountId);
    this.deps.onLiveStopped?.(accountId);
    if (this.focusedAccountId === accountId) this.focusedAccountId = undefined;
  }

  setCurrentProduct(accountId: string, productId: string | undefined): void {
    this.ensureRuntime(accountId).setCurrentProduct(productId);
  }

  setAutomationMode(accountId: string, mode: AutomationMode): void {
    this.ensureRuntime(accountId).setAutomationMode(mode);
  }

  async resolveApproval(
    accountId: string,
    approvalId: string,
    decision: "approve" | "reject",
    editedSpeech?: string
  ): Promise<void> {
    const runtime = this.runtimes.get(accountId);
    if (!runtime) throw new Error("LIVE_RUNTIME_NOT_FOUND");

    for (const [otherId, other] of this.runtimes) {
      if (otherId === accountId) continue;
      if (other.listApprovals().some((a) => a.id === approvalId)) {
        throw new Error("APPROVAL_ACCOUNT_MISMATCH");
      }
    }

    const owned = runtime.listApprovals().some((a) => a.id === approvalId);
    if (!owned) throw new Error("APPROVAL_NOT_FOUND");

    await runtime.resolveApproval(approvalId, decision, editedSpeech);
  }

  cancelAutoApproval(accountId: string, approvalId: string): ApprovalItem {
    const runtime = this.requireRuntime(accountId);
    return runtime.cancelAutoApproval(approvalId);
  }

  cancelNearestAutoApproval(accountId: string): ApprovalItem | undefined {
    return this.requireRuntime(accountId).cancelNearestAutoApproval();
  }

  stopAutomation(accountId: string): void {
    this.requireRuntime(accountId).stopAutomation();
  }

  enterTakeover(accountId: string): OperatorControlMode {
    this.assertNotDisposed();
    const control = this.requireOperatorControl();
    control.enterTakeover(accountId);
    const runtime = this.runtimes.get(accountId);
    runtime?.enterTakeover();
    this.deps.onOperatorControlChanged?.(accountId);
    return control.getMode(accountId);
  }

  exitTakeover(accountId: string): OperatorControlMode {
    this.assertNotDisposed();
    const control = this.requireOperatorControl();
    control.exitTakeover(accountId);
    const runtime = this.runtimes.get(accountId);
    runtime?.exitTakeover();
    this.deps.onOperatorControlChanged?.(accountId);
    return control.getMode(accountId);
  }

  /** Toggle takeover for focused hotkey. */
  toggleTakeover(accountId: string): OperatorControlMode {
    const mode = this.deps.operatorControl?.getMode(accountId) ?? "AI_ACTIVE";
    if (mode === "HUMAN_TAKEOVER") return this.exitTakeover(accountId);
    return this.enterTakeover(accountId);
  }

  /**
   * Global emergency: mute all runtimes. Does not logout / disconnect TikTok / delete sessions.
   */
  emergencyStopAllAi(): OperatorControlPublicSnapshot {
    this.assertNotDisposed();
    const control = this.requireOperatorControl();
    const ids = this.listAccounts().map((a) => a.id);
    const snap = control.emergencyStopAll(ids);
    for (const rt of this.runtimes.values()) {
      rt.muteAi();
      rt.stopAutomation();
    }
    this.deps.onOperatorControlChanged?.(undefined);
    return snap;
  }

  getOperatorControlSnapshot(): OperatorControlPublicSnapshot {
    const control = this.deps.operatorControl;
    const ids = this.listAccounts().map((a) => a.id);
    if (!control) {
      return {
        byAccount: {},
        emergencyStop: false,
        takeoverHotkey: "F8"
      };
    }
    return control.snapshot(ids);
  }

  getSnapshot(accountId: string): AccountLiveSnapshot {
    const account = this.deps.accounts.get(accountId);
    if (!account) throw new Error("TIKTOK_ACCOUNT_NOT_FOUND");
    return this.buildSnapshot(account);
  }

  getAllSnapshots(): AccountLiveSnapshot[] {
    return this.listAccounts().map((a) => this.buildSnapshot(a));
  }

  countRunning(): number {
    let n = 0;
    for (const rt of this.runtimes.values()) {
      if (rt.isRunning) n += 1;
    }
    return n;
  }

  get maxConcurrentLives(): number {
    return this.deps.capacity.getLicenseLimits().maxConcurrentLives;
  }

  /** Pending approvals across all runtimes — for Live Center operator queue. */
  listAllPendingApprovals(): ApprovalItem[] {
    const out: ApprovalItem[] = [];
    for (const rt of this.runtimes.values()) {
      for (const item of rt.listApprovals()) {
        out.push(item);
      }
    }
    return out;
  }

  /**
   * Resolve account for legacy IPC that omits accountId.
   * Production: always requires explicit accountId.
   * Dev/test: may use focusedAccountId only (never silently pick list()[0] at call time).
   */
  resolveAccountIdForLegacyIpc(
    accountId: string | undefined,
    opts: { isPackaged: boolean }
  ): string {
    if (accountId?.trim()) return accountId.trim();
    if (opts.isPackaged) throw new Error("ACCOUNT_ID_REQUIRED");
    if (this.focusedAccountId) return this.focusedAccountId;
    throw new Error("ACCOUNT_ID_REQUIRED");
  }

  /** Tear down all runtimes (app quit). Does not close DB / Khepree / LLM. */
  dispose(): void {
    if (this.disposed) return;
    this.stopAll();
    for (const id of [...this.runtimes.keys()]) {
      this.disposeAccount(id);
    }
    this.disposed = true;
  }

  private requireRuntime(accountId: string): LiveRuntime {
    const runtime = this.runtimes.get(accountId);
    if (!runtime) throw new Error("LIVE_RUNTIME_NOT_FOUND");
    return runtime;
  }

  private buildSnapshot(account: TikTokAccount): AccountLiveSnapshot {
    const runtime = this.runtimes.get(account.id);
    const settings = this.deps.accountLiveSettings.get(account.id);
    return {
      accountId: account.id,
      username: account.username,
      label: account.label,
      isRunning: runtime?.isRunning ?? false,
      sessionId: runtime?.sessionId,
      liveStartedAt: runtime?.liveStartedAt,
      state: runtime?.state ?? "IDLE",
      automationMode:
        runtime?.automationMode ??
        settings?.automationMode ??
        DEFAULT_ACCOUNT_AUTOMATION_MODE,
      currentProductId: runtime?.currentProductId ?? settings?.currentProductId,
      pendingApprovalCount: runtime?.listApprovals().length ?? 0,
      operatorMode: this.deps.operatorControl?.getMode(account.id) ?? "AI_ACTIVE",
      scene: runtime?.getSceneState(),
      health: runtime?.health() ?? {
        component: `live-runtime:${account.id}`,
        status: "DISABLED",
        message: "no runtime",
        checkedAt: new Date().toISOString()
      }
    };
  }

  private requireOperatorControl(): OperatorControlService {
    if (!this.deps.operatorControl) throw new Error("OPERATOR_CONTROL_UNAVAILABLE");
    return this.deps.operatorControl;
  }

  private assertNotDisposed(): void {
    if (this.disposed) throw new Error("MULTI_LIVE_MANAGER_DISPOSED");
  }
}
