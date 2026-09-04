import { app } from "electron";
import path from "node:path";
import type {
  LiveManagerPhase,
  LiveManagerPublicState
} from "../../../shared/live-manager-contracts";
import { LIVE_MANAGER_EMPTY_PACK_MESSAGE_VI } from "../../../shared/live-manager-contracts";
import { assertLiveManagerActivityHelpers } from "../../../shared/live-manager-activity";
import type { LiveEvent } from "../../../shared/live-types";
import type { LiveEventBus } from "../../core/event-bus";
import { resolveAppRoot } from "../../app-paths";
import { LiveManagerObserver } from "./live-manager-observer";
import { isSelectorPackEmpty, loadLiveManagerSelectorPack } from "./selector-pack-loader";
import os from "node:os";
import fs from "node:fs";

const ACTIVITY_POLL_MS = 1_500;

export type LiveManagerManagerOptions = {
  eventBus: LiveEventBus;
  /** Optional persistence — never call LLM/media from here. */
  onEvent?: (event: LiveEvent) => void;
};

/**
 * Owns Playwright LIVE Manager browser workflow for the operator.
 * Activity scans publish normalized events to the Event Bus only — never voice.
 */
export class LiveManagerManager {
  private observer?: LiveManagerObserver;
  private phase: LiveManagerPhase = "CLOSED";
  private message?: string;
  private lastCheckedAt?: string;
  private opening = false;
  private activityTimer?: NodeJS.Timeout;
  private scanning = false;
  private publishedCount = 0;
  private boundProfileKey?: string;

  constructor(private readonly opts: LiveManagerManagerOptions) {}

  getPublicState(): LiveManagerPublicState {
    const pack = loadLiveManagerSelectorPack(resolveAppRoot());
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

  async health() {
    const state = this.getPublicState();
    return {
      component: "tiktok:live-manager",
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
   * Open LIVE Manager browser for a TikTok account profile.
   * profileKey must be filesystem-safe (TikTokAccount.profileKey).
   */
  async open(profileKey = "tiktok-live-manager"): Promise<LiveManagerPublicState> {
    if (this.opening) return this.getPublicState();
    this.opening = true;
    this.phase = "OPENING";
    this.message = "Opening TikTok LIVE Manager…";
    try {
      if (this.observer && this.boundProfileKey !== profileKey) {
        this.stopActivityPoll();
        await this.observer.close();
        this.observer = undefined;
        this.publishedCount = 0;
      }

      if (!this.observer) {
        const pack = loadLiveManagerSelectorPack(resolveAppRoot());
        const diagnosticsDir = path.join(
          app.getPath("userData"),
          "diagnostics",
          "live-manager",
          profileKey
        );
        this.observer = new LiveManagerObserver(
          app.getPath("userData"),
          pack,
          diagnosticsDir,
          profileKey
        );
        this.boundProfileKey = profileKey;
      } else {
        this.observer.updateSelectorPack(loadLiveManagerSelectorPack(resolveAppRoot()));
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
        // Never call media/voice from this path.
        this.opts.eventBus.publish(event);
        this.opts.onEvent?.(event);
        this.publishedCount += 1;
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
