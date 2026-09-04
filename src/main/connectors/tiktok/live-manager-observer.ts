import fs from "node:fs";
import path from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";
import type { LiveEvent } from "../../../shared/live-types";
import {
  ActivityFingerprintStore,
  buildLiveManagerActivityEvent,
  type LiveManagerActivityKind
} from "../../../shared/live-manager-activity";
import { isSelectorPackEmpty } from "./selector-pack-loader";

export interface SelectorPack {
  version: string;
  urls: { liveManager: string };
  selectors: {
    commentRows: string[];
    orderRows: string[];
    violationRows: string[];
    productActivityRows: string[];
  };
  loginHints?: {
    signedInUrlIncludes: string[];
    loginUrlIncludes: string[];
  };
}

export type LiveManagerBrowserStatus =
  | "closed"
  | "opening"
  | "waiting_login"
  | "signed_in"
  | "ready"
  | "error";

/**
 * Playwright persistent-context observer for TikTok LIVE Manager.
 * Operator logs in manually — never collect passwords / bypass OTP / CAPTCHA.
 * Selectors come only from the external selector pack.
 * Scans publish candidates only — never call voice/TTS or media APIs.
 */
export class LiveManagerObserver {
  private context?: BrowserContext;
  private page?: Page;
  private sequence = 0;
  private status: LiveManagerBrowserStatus = "closed";
  private lastError?: string;
  private lastDiagnosticScreenshot?: string;
  private pollTimer?: NodeJS.Timeout;
  private readonly fingerprints = new ActivityFingerprintStore();
  readonly profileDir: string;
  readonly profileKey: string;

  constructor(
    private readonly userDataDir: string,
    private selectorPack: SelectorPack,
    private readonly diagnosticsDir: string,
    profileKey = "tiktok-live-manager"
  ) {
    // profileKey is filesystem-safe (from TikTokAccount.profileKey); never use raw username.
    this.profileKey = profileKey;
    this.profileDir = path.join(this.userDataDir, "browser-profiles", profileKey);
  }

  getBrowserStatus(): LiveManagerBrowserStatus {
    return this.status;
  }

  getLastError(): string | undefined {
    return this.lastError;
  }

  getLastDiagnosticScreenshot(): string | undefined {
    return this.lastDiagnosticScreenshot;
  }

  isPackEmpty(): boolean {
    return isSelectorPackEmpty(this.selectorPack);
  }

  getPackVersion(): string {
    return this.selectorPack.version;
  }

  async open(): Promise<void> {
    if (this.context) return;
    this.status = "opening";
    this.lastError = undefined;
    try {
      fs.mkdirSync(this.profileDir, { recursive: true });
      this.context = await chromium.launchPersistentContext(this.profileDir, {
        headless: false,
        viewport: null
      });
      this.page = this.context.pages()[0] ?? (await this.context.newPage());
      await this.page.goto(this.selectorPack.urls.liveManager, {
        waitUntil: "domcontentloaded"
      });
      this.status = "waiting_login";
      this.startStatusPoll();
      await this.refreshLoginStatus();
    } catch (error) {
      this.status = "error";
      this.lastError = String(error);
      await this.close().catch(() => undefined);
      throw new Error(`BROWSER_SESSION_FAILED:${this.lastError}`);
    }
  }

  async close(): Promise<void> {
    this.stopStatusPoll();
    this.fingerprints.clear();
    try {
      await this.context?.close();
    } finally {
      this.context = undefined;
      this.page = undefined;
      this.status = "closed";
    }
  }

  /**
   * Soft-fail DOM scan. Empty packs return [].
   * Deduplicates via fingerprint so repeated polls do not re-emit.
   */
  async scanVisibleEvents(): Promise<LiveEvent[]> {
    if (!this.page) return [];
    if (this.isPackEmpty()) return [];

    const events: LiveEvent[] = [];
    let attempted = false;
    let anySelectorWorked = false;

    const channels: Array<{ kind: LiveManagerActivityKind; selectors: string[] }> = [
      { kind: "COMMENT", selectors: this.selectorPack.selectors.commentRows },
      { kind: "ORDER_ACTIVITY", selectors: this.selectorPack.selectors.orderRows },
      { kind: "VIOLATION", selectors: this.selectorPack.selectors.violationRows },
      {
        kind: "PRODUCT_ACTIVITY",
        selectors: this.selectorPack.selectors.productActivityRows
      }
    ];

    for (const channel of channels) {
      if (!channel.selectors.length) continue;
      attempted = true;
      const rows = await this.readRowTexts(channel.selectors);
      if (rows.matched) anySelectorWorked = true;
      for (const text of rows.texts) {
        const event = this.toEvent(channel.kind, text);
        if (event) events.push(event);
      }
    }

    if (attempted && !anySelectorWorked) {
      await this.captureDiagnosticScreenshot("selector-fail").catch(() => undefined);
    }

    return events;
  }

  /** Local diagnostic only — never uploaded. */
  async captureDiagnosticScreenshot(reason: string): Promise<string | undefined> {
    if (!this.page) return undefined;
    fs.mkdirSync(this.diagnosticsDir, { recursive: true });
    const file = path.join(
      this.diagnosticsDir,
      `live-manager-${reason}-${Date.now()}.png`
    );
    await this.page.screenshot({ path: file, fullPage: true });
    this.lastDiagnosticScreenshot = file;
    return file;
  }

  updateSelectorPack(pack: SelectorPack): void {
    this.selectorPack = pack;
  }

  async refreshLoginStatus(): Promise<LiveManagerBrowserStatus> {
    if (!this.page || !this.context) {
      this.status = "closed";
      return this.status;
    }
    try {
      const url = this.page.url().toLowerCase();
      const hints = this.selectorPack.loginHints ?? {
        signedInUrlIncludes: ["/live/manager", "/seller"],
        loginUrlIncludes: ["login", "passport", "signin"]
      };

      const looksLogin = hints.loginUrlIncludes.some((h) => url.includes(h.toLowerCase()));
      const looksSignedIn = hints.signedInUrlIncludes.some((h) =>
        url.includes(h.toLowerCase())
      );

      if (looksLogin && !looksSignedIn) {
        this.status = "waiting_login";
        return this.status;
      }

      if (looksSignedIn || (!looksLogin && url.includes("tiktok.com"))) {
        this.status = this.isPackEmpty() ? "signed_in" : "ready";
        if (url.includes("/live/manager") || url.includes("/live/")) {
          this.status = "ready";
        }
        return this.status;
      }

      this.status = "waiting_login";
      return this.status;
    } catch (error) {
      this.status = "error";
      this.lastError = String(error);
      return this.status;
    }
  }

  private toEvent(kind: LiveManagerActivityKind, text: string): LiveEvent | undefined {
    const trimmed = text.trim();
    if (!trimmed) return undefined;
    const draft = buildLiveManagerActivityEvent({
      kind,
      text: trimmed,
      sequence: this.sequence + 1
    });
    const fp = draft.fingerprint;
    if (!fp || !this.fingerprints.remember(fp)) return undefined;
    this.sequence += 1;
    return { ...draft, sequence: this.sequence, id: `live-manager-${kind.toLowerCase()}-${this.sequence}` };
  }

  private async readRowTexts(
    selectors: string[]
  ): Promise<{ matched: boolean; texts: string[] }> {
    if (!this.page) return { matched: false, texts: [] };
    for (const selector of selectors) {
      try {
        const texts = await this.page.locator(selector).allTextContents();
        return {
          matched: true,
          texts: texts.map((t) => t.trim()).filter(Boolean).slice(-30)
        };
      } catch {
        // try next selector variant
      }
    }
    return { matched: false, texts: [] };
  }

  private startStatusPoll(): void {
    this.stopStatusPoll();
    this.pollTimer = setInterval(() => {
      void this.refreshLoginStatus();
    }, 2000);
  }

  private stopStatusPoll(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }
  }
}

export const EMPTY_SELECTOR_PACK: SelectorPack = {
  version: "0-foundation",
  urls: { liveManager: "https://seller-us.tiktok.com/live/manager" },
  selectors: {
    commentRows: [],
    orderRows: [],
    violationRows: [],
    productActivityRows: []
  },
  loginHints: {
    signedInUrlIncludes: ["/live/manager", "/seller"],
    loginUrlIncludes: ["login", "passport", "signin"]
  }
};
