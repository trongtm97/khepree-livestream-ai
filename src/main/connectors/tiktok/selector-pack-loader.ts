import fs from "node:fs";
import path from "node:path";
import type { SelectorPack } from "./live-manager-observer";

export function loadLiveManagerSelectorPack(appRoot: string): SelectorPack {
  const file = path.join(
    appRoot,
    "resources",
    "selector-packs",
    "tiktok-live-manager.foundation.json"
  );
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as SelectorPack;
    return normalizePack(raw);
  } catch {
    return {
      version: "0-missing",
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
  }
}

export function isSelectorPackEmpty(pack: SelectorPack): boolean {
  const s = pack.selectors;
  return (
    s.commentRows.length === 0 &&
    s.orderRows.length === 0 &&
    s.violationRows.length === 0 &&
    s.productActivityRows.length === 0
  );
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function normalizePack(raw: Partial<SelectorPack> & { urls?: { liveManager?: string } }): SelectorPack {
  return {
    version: String(raw.version ?? "0"),
    urls: {
      liveManager:
        raw.urls?.liveManager?.trim() || "https://seller-us.tiktok.com/live/manager"
    },
    selectors: {
      commentRows: asStringArray(raw.selectors?.commentRows),
      orderRows: asStringArray(raw.selectors?.orderRows),
      violationRows: asStringArray(raw.selectors?.violationRows),
      productActivityRows: asStringArray(raw.selectors?.productActivityRows)
    },
    loginHints: {
      signedInUrlIncludes: Array.isArray(raw.loginHints?.signedInUrlIncludes)
        ? raw.loginHints!.signedInUrlIncludes.map(String)
        : ["/live/manager", "/seller"],
      loginUrlIncludes: Array.isArray(raw.loginHints?.loginUrlIncludes)
        ? raw.loginHints!.loginUrlIncludes.map(String)
        : ["login", "passport", "signin"]
    }
  };
}
