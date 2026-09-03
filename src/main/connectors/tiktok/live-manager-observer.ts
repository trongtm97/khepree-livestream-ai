import path from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";
import type { LiveEvent } from "../../../shared/live-types";

export interface SelectorPack {
  version: string;
  urls: { liveManager: string };
  selectors: {
    commentRows: string[];
    orderRows: string[];
    violationRows: string[];
  };
}

export class LiveManagerObserver {
  private context?: BrowserContext;
  private page?: Page;
  private sequence = 0;

  constructor(
    private readonly userDataDir: string,
    private selectorPack: SelectorPack
  ) {}

  async open(): Promise<void> {
    const profileDir = path.join(this.userDataDir, "browser-profiles", "tiktok-live-manager");
    this.context = await chromium.launchPersistentContext(profileDir, {
      headless: false,
      viewport: null
    });
    this.page = this.context.pages()[0] ?? await this.context.newPage();
    await this.page.goto(this.selectorPack.urls.liveManager, { waitUntil: "domcontentloaded" });
  }

  async close(): Promise<void> {
    await this.context?.close();
    this.context = undefined;
    this.page = undefined;
  }

  /**
   * Foundation only. A later selector pack must be validated against a real
   * LIVE Manager account. This method intentionally fails soft.
   */
  async scanVisibleEvents(): Promise<LiveEvent[]> {
    if (!this.page) return [];
    const events: LiveEvent[] = [];

    for (const selector of this.selectorPack.selectors.commentRows) {
      try {
        const texts = await this.page.locator(selector).allTextContents();
        for (const text of texts.slice(-20)) {
          if (!text.trim()) continue;
          this.sequence += 1;
          events.push({
            id: `live-manager-comment-${this.sequence}`,
            sequence: this.sequence,
            type: "COMMENT",
            source: "live-manager",
            timestamp: new Date().toISOString(),
            text: text.trim()
          });
        }
        if (texts.length) break;
      } catch {
        // try next selector variant
      }
    }
    return events;
  }

  updateSelectorPack(pack: SelectorPack): void {
    this.selectorPack = pack;
  }
}

export const EMPTY_SELECTOR_PACK: SelectorPack = {
  version: "0-foundation",
  urls: { liveManager: "https://seller-us.tiktok.com/live/manager" },
  selectors: {
    commentRows: [],
    orderRows: [],
    violationRows: []
  }
};
