import type { LiveEventBus } from "../../core/event-bus";
import type { LiveEvent } from "../../../shared/live-types";
import { UNASSIGNED_ACCOUNT_ID } from "../../../shared/live-types";
import type {
  TikTokConnectionPhase,
  TikTokPublicState
} from "../../../shared/tiktok-contracts";
import { normalizeUniqueId, TikTokWorkerProvider } from "./tiktok-worker-provider";

const POLL_MS = 500;
const BACKOFF_MS = [2_000, 5_000, 10_000, 20_000, 60_000] as const;
const COMMENT_WINDOW_MS = 60_000;

export type TikTokConnectorManagerOptions = {
  appRoot: string;
  eventBus: LiveEventBus;
  pythonExecutable?: string;
  startupTimeoutMs?: number;
  /** Optional persistence — never call LLM from here. */
  onEvent?: (event: LiveEvent) => void;
  getSavedUniqueId?: () => string | undefined;
  setSavedUniqueId?: (id: string | undefined) => void;
};

/**
 * Owns TikTokLive worker lifecycle, non-blocking event drain → LiveEventBus,
 * and reconnect with backoff. Does not call Gemini.
 */
export class TikTokConnectorManager {
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
    this.provider = new TikTokWorkerProvider(
      opts.appRoot,
      opts.pythonExecutable ?? process.env.KHEPREE_PYTHON ?? "python",
      opts.startupTimeoutMs
        ?? Number(process.env.KHEPREE_WORKER_STARTUP_TIMEOUT_MS ?? 20000)
    );
    const saved = opts.getSavedUniqueId?.()?.trim();
    if (saved) this.uniqueId = normalizeUniqueId(saved);
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

  async health() {
    const state = this.getPublicState();
    return {
      component: "tiktok:tiktoklive",
      status:
        state.phase === "CONNECTED"
          ? ("OK" as const)
          : state.phase === "CONNECTING" || state.phase === "RECONNECTING"
            ? ("DEGRADED" as const)
            : state.phase === "DISCONNECTED"
              ? ("DISABLED" as const)
              : ("DOWN" as const),
      message: state.message ?? state.phase,
      checkedAt: state.lastCheckedAt ?? new Date().toISOString()
    };
  }

  async connect(rawUniqueId: string): Promise<TikTokPublicState> {
    const uniqueId = normalizeUniqueId(rawUniqueId);
    if (!uniqueId || uniqueId === "@") throw new Error("TIKTOK_UNIQUE_ID_REQUIRED");

    this.clearReconnectTimer();
    this.wantConnected = true;
    this.uniqueId = uniqueId;
    this.opts.setSavedUniqueId?.(uniqueId);
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

  private startPollLoop(): void {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => {
      void this.pollOnce();
    }, POLL_MS);
    // Unref so poll does not keep Electron main alive alone if needed — keep referenced
    // because livestream session should keep process attentive.
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
        this.lastSequence = event.sequence;
        this.eventCount += 1;
        if (event.type === "COMMENT") {
          this.commentTimestamps.push(Date.now());
          this.trimCommentWindow();
        }
        // Stamp account provenance (real accountId wiring lands in later multi-live tasks).
        const stamped: LiveEvent = {
          ...event,
          accountId: event.accountId || UNASSIGNED_ACCOUNT_ID
        };
        // Strict rule: worker events only enter the app via Event Bus.
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

      // Health probe occasionally when idle drain
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
}
