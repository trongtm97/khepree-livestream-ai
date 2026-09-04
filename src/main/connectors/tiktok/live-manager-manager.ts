import { app } from "electron";
import path from "node:path";
import type {
  AccountLiveManagerState,
  LiveManagerPhase,
  LiveManagerPublicState
} from "../../../shared/live-manager-contracts";
import { LIVE_MANAGER_EMPTY_PACK_MESSAGE_VI } from "../../../shared/live-manager-contracts";
import { assertLiveManagerActivityHelpers } from "../../../shared/live-manager-activity";
import type { LiveEvent } from "../../../shared/live-types";
import type { LiveEventBus } from "../../core/event-bus";
import { resolveAppRoot } from "../../app-paths";
import { LiveManagerObserver, type SelectorPack } from "./live-manager-observer";
import { isSelectorPackEmpty, loadLiveManagerSelectorPack } from "./selector-pack-loader";
import os from "node:os";
import fs from "node:fs";

const ACTIVITY_POLL_MS = 1_500;

export type LiveManagerObserverFactoryArgs = {
  userDataDir: string;
  pack: SelectorPack;
  diagnosticsDir: string;
  profileKey: string;
};

export type LiveManagerManagerOptions = {
  /** Hard-bound account — event provenance never comes from UI focus. */
  accountId: string;
  /** Filesystem-safe profile key from TikTokAccount.profileKey. */
  profileKey: string;
  eventBus: LiveEventBus;
  /** Optional persistence — never call LLM/media from here. */
  onEvent?: (event: LiveEvent) => void;
  /** Override Electron userData (tests). */
  userDataDir?: string;
  appRoot?: string;
  /** Test seam — skip real Playwright. */
  createObserver?: (args: LiveManagerObserverFactoryArgs) => LiveManagerObserver;
};

/**
 * Owns one Playwright LIVE Manager browser for a single TikTok account.
 * Activity scans publish normalized events to the Event Bus only — never voice.
 */
export class LiveManagerManager {
  readonly accountId: string;
  readonly profileKey: string;
  private observer?: LiveManagerObserver;
  private phase: LiveManagerPhase = "CLOSED";
  private message?: string;
  private lastCheckedAt?: string;
  private opening = false;
  private activityTimer?: NodeJS.Timeout;
  private scanning = false;
  private publishedCount = 0;
  private boundProfileKey: string;

  constructor(private readonly opts: LiveManagerManagerOptions) {
    if (!opts.accountId?.trim()) throw new Error("ACCOUNT_ID_REQUIRED");
    if (!opts.profileKey?.trim()) throw new Error("INVALID_PROFILE_KEY");
    this.accountId = opts.accountId.trim();
    this.profileKey = opts.profileKey.trim();
    this.boundProfileKey = this.profileKey;
  }

  getPublicState(): LiveManagerPublicState {
    const pack = loadLiveManagerSelectorPack(this.opts.appRoot ?? resolveAppRoot());
    const empty = isSelectorPackEmpty(pack);
    const obs = this.observer;
    const phase = obs ? mapBrowserStatus(obs.getBrowserStatus()) : this.phase;

    return {
      phase,
      message: this.message ?? obs?.getLastError(),
      selectorPackEmpty: empty,
      selectorPackVersion: pack.version,
      profileDir: obs?.profileDir,
      lastCheckedAt: this.lastCheckedAt,
      lastDiagnosticScreenshot: obs?.getLastDiagnosticScreenshot(),
      activityFeedConfigured: !empty,
      publishedEventCount: this.publishedCount
    };
  }

  getAccountState(): AccountLiveManagerState {
    const pub = this.getPublicState();
    return {
      accountId: this.accountId,
      phase: pub.phase,
      selectorPackVersion: pub.selectorPackVersion,
      activityFeedConfigured: pub.activityFeedConfigured,
      publishedEventCount: pub.publishedEventCount ?? 0,
      lastCheckedAt: pub.lastCheckedAt,
      message: pub.message,
      lastDiagnosticScreenshot: pub.lastDiagnosticScreenshot
    };
  }

  async health() {
    const state = this.getPublicState();
    return {
      component: `tiktok:live-manager:${this.accountId}`,
      status:
        state.phase === "READY"
          ? ("OK" as const)
          : state.phase === "WAITING_LOGIN" ||
              state.phase === "SIGNED_IN" ||
              state.phase === "OPENING"
            ? ("DEGRADED" as const)
            : state.phase === "CLOSED"
              ? ("DISABLED" as const)
              : ("DOWN" as const),
      message: state.message ?? state.phase,
      checkedAt: state.lastCheckedAt ?? new Date().toISOString()
    };
  }

  /**
   * Open LIVE Manager browser for this account's profile.
   * profileKey must be filesystem-safe (TikTokAccount.profileKey).
   * Bound managers ignore a mismatched key and keep their account profile.
   */
  async open(profileKey = this.boundProfileKey): Promise<LiveManagerPublicState> {
    if (this.opening) return this.getPublicState();
    this.opening = true;
    this.phase = "OPENING";
    this.message = "Opening TikTok LIVE Manager…";
    try {
      const key = profileKey.trim() || this.boundProfileKey;
      // One manager = one account = one profile — never swap mid-flight.
      if (key !== this.boundProfileKey) {
        throw new Error("LIVE_MANAGER_PROFILE_MISMATCH");
      }

      if (!this.observer) {
        const userDataDir = this.opts.userDataDir ?? app.getPath("userData");
        const pack = loadLiveManagerSelectorPack(this.opts.appRoot ?? resolveAppRoot());
        // Diagnostics per accountId so A screenshots never overwrite B.
        const diagnosticsDir = path.join(
          userDataDir,
          "diagnostics",
          "live-manager",
          this.accountId
        );
        const args: LiveManagerObserverFactoryArgs = {
          userDataDir,
          pack,
          diagnosticsDir,
          profileKey: this.boundProfileKey
        };
        this.observer =
          this.opts.createObserver?.(args) ??
          new LiveManagerObserver(
            args.userDataDir,
            args.pack,
            args.diagnosticsDir,
            args.profileKey
          );
      } else {
        this.observer.updateSelectorPack(
          loadLiveManagerSelectorPack(this.opts.appRoot ?? resolveAppRoot())
        );
      }
      await this.observer.open();
      this.lastCheckedAt = new Date().toISOString();
      this.phase = mapBrowserStatus(this.observer.getBrowserStatus());
      this.message =
        this.phase === "WAITING_LOGIN"
          ? "Sign in manually in the browser window (password/OTP/CAPTCHA stay with you)."
          : undefined;
      this.startActivityPoll();
      return this.getPublicState();
    } catch (error) {
      this.phase = "ERROR";
      this.message = String(error instanceof Error ? error.message : error);
      this.stopActivityPoll();
      throw error instanceof Error ? error : new Error(String(error));
    } finally {
      this.opening = false;
    }
  }

  async close(): Promise<LiveManagerPublicState> {
    this.stopActivityPoll();
    await this.observer?.close();
    this.observer = undefined;
    this.phase = "CLOSED";
    this.message = undefined;
    this.lastCheckedAt = new Date().toISOString();
    return this.getPublicState();
  }

  async captureDiagnostic(): Promise<LiveManagerPublicState> {
    if (!this.observer) throw new Error("BROWSER_SESSION_FAILED:not open");
    await this.observer.captureDiagnosticScreenshot("manual");
    this.lastCheckedAt = new Date().toISOString();
    return this.getPublicState();
  }

  async refresh(): Promise<LiveManagerPublicState> {
    if (this.observer) {
      await this.observer.refreshLoginStatus();
      this.phase = mapBrowserStatus(this.observer.getBrowserStatus());
    }
    this.lastCheckedAt = new Date().toISOString();
    return this.getPublicState();
  }

  async dispose(): Promise<void> {
    await this.close();
  }

  /** Same stamp + publish path as activity poll — multi-account isolation tests. */
  ingestActivityEvent(event: LiveEvent): void {
    this.publishStamped(event);
  }

  /** Mark open without Playwright (tests). */
  markReadyForTest(): void {
    this.phase = "READY";
    this.lastCheckedAt = new Date().toISOString();
    this.message = undefined;
  }

  getObserverForTest(): LiveManagerObserver | undefined {
    return this.observer;
  }

  private publishStamped(event: LiveEvent): void {
    const stamped: LiveEvent = {
      ...event,
      accountId: this.accountId
    };
    this.opts.eventBus.publish(stamped);
    this.opts.onEvent?.(stamped);
    this.publishedCount += 1;
  }

  private startActivityPoll(): void {
    this.stopActivityPoll();
    this.activityTimer = setInterval(() => {
      void this.pollActivityOnce();
    }, ACTIVITY_POLL_MS);
  }

  private stopActivityPoll(): void {
    if (this.activityTimer) {
      clearInterval(this.activityTimer);
      this.activityTimer = undefined;
    }
    this.scanning = false;
  }

  private async pollActivityOnce(): Promise<void> {
    if (this.scanning || !this.observer) return;
    const status = this.observer.getBrowserStatus();
    if (status !== "ready" && status !== "signed_in") return;
    if (this.observer.isPackEmpty()) return;

    this.scanning = true;
    try {
      const events = await this.observer.scanVisibleEvents();
      for (const event of events) {
        // Strict rule: LIVE Manager activity enters the app only via Event Bus.
        // Never call media/voice from this path. Always stamp bound accountId.
        this.publishStamped(event);
      }
      this.lastCheckedAt = new Date().toISOString();
      this.phase = mapBrowserStatus(this.observer.getBrowserStatus());
    } catch (error) {
      this.message = String(error);
    } finally {
      this.scanning = false;
    }
  }
}

function mapBrowserStatus(
  status: ReturnType<LiveManagerObserver["getBrowserStatus"]>
): LiveManagerPhase {
  switch (status) {
    case "opening":
      return "OPENING";
    case "waiting_login":
      return "WAITING_LOGIN";
    case "signed_in":
      return "SIGNED_IN";
    case "ready":
      return "READY";
    case "error":
      return "ERROR";
    default:
      return "CLOSED";
  }
}

// ponytail: self-check — empty pack + phase map + profileKey path binding
export function assertLiveManagerContract(): void {
  assertLiveManagerActivityHelpers();
  const empty = isSelectorPackEmpty({
    version: "t",
    urls: { liveManager: "https://example.com" },
    selectors: {
      commentRows: [],
      orderRows: [],
      violationRows: [],
      productActivityRows: []
    }
  });
  if (!empty) throw new Error("empty pack detection failed");
  if (mapBrowserStatus("waiting_login") !== "WAITING_LOGIN") {
    throw new Error("phase map failed");
  }
  if (!LIVE_MANAGER_EMPTY_PACK_MESSAGE_VI.includes("Activity Feed")) {
    throw new Error("empty pack VI message drifted");
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "khepree-lm-profile-"));
  try {
    const pack = {
      version: "t",
      urls: { liveManager: "https://example.com" },
      selectors: {
        commentRows: [] as string[],
        orderRows: [] as string[],
        violationRows: [] as string[],
        productActivityRows: [] as string[]
      }
    };
    const key = "tt_abc123def456";
    const obs = new LiveManagerObserver(tmp, pack, path.join(tmp, "diag"), key);
    const normalized = obs.profileDir.replace(/\\/g, "/");
    if (!normalized.endsWith(`browser-profiles/${key}`)) {
      throw new Error(`profileKey must map to browser-profiles/<key>, got ${obs.profileDir}`);
    }
    if (obs.profileKey !== key) {
      throw new Error("observer profileKey mismatch");
    }
  } finally {
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* Windows */
    }
  }
}
