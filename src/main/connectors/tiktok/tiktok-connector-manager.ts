import type { LiveEventBus } from "../../core/event-bus";
import type { LiveEvent } from "../../../shared/live-types";
import type {
  AccountTikTokState,
  TikTokConnectionPhase,
  TikTokPublicState
} from "../../../shared/tiktok-contracts";
import {
  normalizeUniqueId,
  shortAccountWorkerId,
  TikTokWorkerProvider
} from "./tiktok-worker-provider";

const POLL_MS = 500;
const BACKOFF_MS = [2_000, 5_000, 10_000, 20_000, 60_000] as const;
const COMMENT_WINDOW_MS = 60_000;

export type TikTokConnectorManagerOptions = {
  /** Hard-bound account — event provenance never comes from UI focus. */
  accountId: string;
  /** Initial username (@uniqueId); connect() may refresh from repo via registry. */
  uniqueId?: string;
  appRoot: string;
  eventBus: LiveEventBus;
  pythonExecutable?: string;
  startupTimeoutMs?: number;
  /** Optional sink — never call LLM from here. */
  onEvent?: (event: LiveEvent) => void;
  /** Test seam. */
  createProvider?: (accountId: string) => TikTokWorkerProvider;
};

/**
 * Owns one TikTokLive worker lifecycle for a single account.
 * Does not call Gemini. Does not read focusedAccountId.
 */
export class TikTokConnectorManager {
  readonly accountId: string;
  readonly provider: TikTokWorkerProvider;
  private lastSequence = 0;
  private pollTimer?: NodeJS.Timeout;
  private reconnectTimer?: NodeJS.Timeout;
  private wantConnected = false;
  private uniqueId?: string;
  private phase: TikTokConnectionPhase = "DISCONNECTED";
  private message?: string;
  private dependencyInstalled?: boolean;
  private connectedAt?: string;
  private lastCheckedAt?: string;
  private eventCount = 0;
  private commentTimestamps: number[] = [];
  private reconnectAttempt = 0;
  private nextRetryMs?: number;
  private draining = false;

  constructor(private readonly opts: TikTokConnectorManagerOptions) {
    if (!opts.accountId?.trim()) throw new Error("ACCOUNT_ID_REQUIRED");
    this.accountId = opts.accountId.trim();
    this.provider =
      opts.createProvider?.(this.accountId) ??
      new TikTokWorkerProvider({
        appRoot: opts.appRoot,
        workerName: `tiktok-worker-${shortAccountWorkerId(this.accountId)}`,
        pythonExecutable: opts.pythonExecutable ?? process.env.KHEPREE_PYTHON ?? "python",
        startupTimeoutMs:
          opts.startupTimeoutMs ??
          Number(process.env.KHEPREE_WORKER_STARTUP_TIMEOUT_MS ?? 20000)
      });
    if (opts.uniqueId?.trim()) {
      this.uniqueId = normalizeUniqueId(opts.uniqueId);
    }
  }

  getLastSequence(): number {
    return this.lastSequence;
  }

  getPublicState(): TikTokPublicState {
    return {
      phase: this.phase,
      uniqueId: this.uniqueId,
      connected: this.phase === "CONNECTED",
      dependencyInstalled: this.dependencyInstalled,
      message: this.message,
      lastCheckedAt: this.lastCheckedAt,
      connectedAt: this.connectedAt,
      eventCount: this.eventCount,
      commentsPerMinute: this.computeCommentsPerMinute(),
      lastSequence: this.lastSequence,
      reconnectAttempt: this.reconnectAttempt,
      nextRetryMs: this.nextRetryMs
    };
  }

  getAccountState(): AccountTikTokState {
    const pub = this.getPublicState();
    return {
      accountId: this.accountId,
      phase: pub.phase,
      connected: pub.connected,
      username: pub.uniqueId,
      connectedAt: pub.connectedAt,
      eventCount: pub.eventCount,
      commentsPerMinute: pub.commentsPerMinute,
      reconnectAttempt: pub.reconnectAttempt,
      message: pub.message,
      lastCheckedAt: pub.lastCheckedAt,
      dependencyInstalled: pub.dependencyInstalled,
      nextRetryMs: pub.nextRetryMs,
      health: {
        component: `tiktok:tiktoklive:${this.accountId}`,
        status:
          pub.phase === "CONNECTED"
            ? ("OK" as const)
            : pub.phase === "CONNECTING" || pub.phase === "RECONNECTING"
              ? ("DEGRADED" as const)
              : pub.phase === "DISCONNECTED"
                ? ("DISABLED" as const)
                : ("DOWN" as const),
        message: pub.message ?? pub.phase,
        checkedAt: pub.lastCheckedAt ?? new Date().toISOString()
      }
    };
  }

  async health() {
    const state = this.getAccountState();
    return state.health;
  }

  async connect(rawUniqueId: string): Promise<TikTokPublicState> {
    const uniqueId = normalizeUniqueId(rawUniqueId);
    if (!uniqueId || uniqueId === "@") throw new Error("TIKTOK_UNIQUE_ID_REQUIRED");

    this.clearReconnectTimer();
    this.wantConnected = true;
    this.uniqueId = uniqueId;
    this.reconnectAttempt = 0;
    this.nextRetryMs = undefined;
    this.phase = "CONNECTING";
    this.message = "Connecting…";

    try {
      await this.provider.connect(uniqueId);
      this.phase = "CONNECTED";
      this.connectedAt = new Date().toISOString();
      this.message = `Connected to ${uniqueId}`;
      this.lastCheckedAt = this.connectedAt;
      const detail = await this.provider.healthDetail();
      this.dependencyInstalled = detail.dependencyInstalled;
      this.startPollLoop();
    } catch (error) {
      this.phase = mapErrorPhase(error);
      this.message = String(error instanceof Error ? error.message : error);
      this.dependencyInstalled = this.phase !== "DEPENDENCY_MISSING" ? this.dependencyInstalled : false;
      if (this.wantConnected && this.phase !== "DEPENDENCY_MISSING") {
        this.scheduleReconnect();
      }
      throw error instanceof Error ? error : new Error(String(error));
    }
    return this.getPublicState();
  }

  async disconnect(): Promise<TikTokPublicState> {
    this.wantConnected = false;
    this.clearReconnectTimer();
    this.stopPollLoop();
    await this.provider.disconnect().catch(() => undefined);
    this.phase = "DISCONNECTED";
    this.message = "Disconnected";
    this.connectedAt = undefined;
    this.nextRetryMs = undefined;
    this.reconnectAttempt = 0;
    this.lastCheckedAt = new Date().toISOString();
    return this.getPublicState();
  }

  async dispose(): Promise<void> {
    this.wantConnected = false;
    this.clearReconnectTimer();
    this.stopPollLoop();
    await this.provider.disconnect().catch(() => undefined);
  }

  /**
   * Same stamp + publish path as worker drain — used by multi-account isolation tests.
   * Always overwrites accountId with this connector's bound account.
   */
  ingestWorkerEvent(event: LiveEvent): void {
    this.publishStamped(event);
  }

  /** Mark connected without a real worker (tests). */
  markConnectedForTest(uniqueId: string): void {
    this.wantConnected = true;
    this.uniqueId = normalizeUniqueId(uniqueId);
    this.phase = "CONNECTED";
    this.connectedAt = new Date().toISOString();
    this.message = `Connected to ${this.uniqueId}`;
    this.lastCheckedAt = this.connectedAt;
    this.dependencyInstalled = true;
  }

  private publishStamped(event: LiveEvent): void {
    if (typeof event.sequence === "number" && event.sequence > this.lastSequence) {
      this.lastSequence = event.sequence;
    }
    this.eventCount += 1;
    if (event.type === "COMMENT") {
      this.commentTimestamps.push(Date.now());
      this.trimCommentWindow();
    }
    const stamped: LiveEvent = {
      ...event,
      accountId: this.accountId
    };
    this.opts.eventBus.publish(stamped);
    this.opts.onEvent?.(stamped);

    if (event.type === "DISCONNECT" && this.wantConnected) {
      this.phase = "RECONNECTING";
      this.message = "Livestream disconnected — reconnecting…";
      this.scheduleReconnect();
    }
    if (event.type === "CONNECT") {
      this.phase = "CONNECTED";
      this.reconnectAttempt = 0;
      this.nextRetryMs = undefined;
      this.connectedAt = event.timestamp || new Date().toISOString();
      this.message = `Connected to ${this.uniqueId ?? ""}`;
    }
  }

  private startPollLoop(): void {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => {
      void this.pollOnce();
    }, POLL_MS);
  }

  private stopPollLoop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }
  }

  private async pollOnce(): Promise<void> {
    if (this.draining || !this.wantConnected) return;
    this.draining = true;
    try {
      const events = await this.provider.drainEvents(this.lastSequence);
      for (const event of events) {
        if (typeof event.sequence !== "number" || event.sequence <= this.lastSequence) {
          continue;
        }
        this.publishStamped(event);
      }

      if (events.length === 0 && this.wantConnected) {
        const detail = await this.provider.healthDetail();
        this.dependencyInstalled = detail.dependencyInstalled;
        this.lastCheckedAt = new Date().toISOString();
        if (!detail.dependencyInstalled) {
          this.phase = "DEPENDENCY_MISSING";
          this.message = detail.message;
          this.wantConnected = false;
          this.stopPollLoop();
          return;
        }
        if (!detail.connected && this.phase === "CONNECTED") {
          this.phase = "RECONNECTING";
          this.message = detail.message || "Connection lost";
          this.scheduleReconnect();
        }
      } else {
        this.lastCheckedAt = new Date().toISOString();
      }
    } catch (error) {
      this.message = String(error);
      if (this.wantConnected) {
        this.phase = "RECONNECTING";
        this.scheduleReconnect();
      }
    } finally {
      this.draining = false;
    }
  }

  private scheduleReconnect(): void {
    if (!this.wantConnected || this.reconnectTimer) return;
    const delay = BACKOFF_MS[Math.min(this.reconnectAttempt, BACKOFF_MS.length - 1)]!;
    this.nextRetryMs = delay;
    this.phase = "RECONNECTING";
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      void this.attemptReconnect();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    this.nextRetryMs = undefined;
  }

  private async attemptReconnect(): Promise<void> {
    if (!this.wantConnected || !this.uniqueId) return;
    this.reconnectAttempt += 1;
    this.message = `Reconnect attempt ${this.reconnectAttempt}…`;
    try {
      await this.provider.disconnectClient().catch(() => undefined);
      await this.provider.connect(this.uniqueId);
      this.phase = "CONNECTED";
      this.connectedAt = new Date().toISOString();
      this.message = `Reconnected to ${this.uniqueId}`;
      this.reconnectAttempt = 0;
      this.nextRetryMs = undefined;
      this.startPollLoop();
    } catch (error) {
      this.message = String(error instanceof Error ? error.message : error);
      this.phase = mapErrorPhase(error);
      if (this.phase === "DEPENDENCY_MISSING") {
        this.wantConnected = false;
        this.stopPollLoop();
        return;
      }
      this.scheduleReconnect();
    }
  }

  private trimCommentWindow(): void {
    const cutoff = Date.now() - COMMENT_WINDOW_MS;
    this.commentTimestamps = this.commentTimestamps.filter((t) => t >= cutoff);
  }

  private computeCommentsPerMinute(): number {
    this.trimCommentWindow();
    return this.commentTimestamps.length;
  }
}

function mapErrorPhase(error: unknown): TikTokConnectionPhase {
  const msg = String(error instanceof Error ? error.message : error).toLowerCase();
  if (msg.includes("not installed") || msg.includes("dependency")) return "DEPENDENCY_MISSING";
  return "CONNECTOR_ERROR";
}

// ponytail: self-check
export function assertTikTokConnectorContract(): void {
  if (BACKOFF_MS[0] !== 2_000 || BACKOFF_MS[BACKOFF_MS.length - 1] !== 60_000) {
    throw new Error("tiktok backoff schedule drifted");
  }
  if (normalizeUniqueId("shop") !== "@shop") throw new Error("normalizeUniqueId failed");
  if (normalizeUniqueId("@@shop") !== "@shop") throw new Error("normalizeUniqueId double-at failed");
  if (shortAccountWorkerId("acc_abc-123!") !== "accabc123") {
    throw new Error("shortAccountWorkerId failed");
  }
}
