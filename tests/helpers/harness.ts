import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openDatabase } from "../../src/main/db/connection";
import {
  AccountLiveSettingsRepository,
  ApprovalRepository,
  LiveEventRepository,
  LiveSessionRepository,
  ProductRepository,
  TikTokAccountRepository
} from "../../src/main/db/repositories";
import { MockLlmProvider } from "../../src/main/connectors/llm/mock-llm-provider";
import { MockMediaProvider } from "../../src/main/connectors/media/mock-media-provider";
import { MultiLiveRuntimeManager } from "../../src/main/live/multi-live-runtime-manager";
import { createTestLiveCapacity } from "../../src/main/live/live-capacity-service";
import type { ProductDNA } from "../../src/shared/live-types";

export type TempDbHarness = {
  userData: string;
  db: ReturnType<typeof openDatabase>;
  products: ProductRepository;
  events: LiveEventRepository;
  approvals: ApprovalRepository;
  sessions: LiveSessionRepository;
  accounts: TikTokAccountRepository;
  accountLiveSettings: AccountLiveSettingsRepository;
  dispose: () => void;
};

export function createTempDb(prefix = "khepree-test-"): TempDbHarness {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const db = openDatabase(userData);
  const products = new ProductRepository(db);
  const events = new LiveEventRepository(db);
  const approvals = new ApprovalRepository(db);
  const sessions = new LiveSessionRepository(db);
  const accounts = new TikTokAccountRepository(db);
  const accountLiveSettings = new AccountLiveSettingsRepository(db);
  return {
    userData,
    db,
    products,
    events,
    approvals,
    sessions,
    accounts,
    accountLiveSettings,
    dispose: () => {
      try {
        db.close();
      } catch {
        /* ignore */
      }
      try {
        fs.rmSync(userData, { recursive: true, force: true });
      } catch {
        /* Windows sqlite lock */
      }
    }
  };
}

export function sampleProduct(id: string, title: string): ProductDNA {
  return {
    id,
    title,
    facts: [],
    benefits: [],
    sizes: ["M", "L"],
    colors: [],
    variants: [],
    faq: [],
    allowedClaims: [],
    forbiddenClaims: [],
    priceText: "199000",
    currency: "VND",
    shippingText: "2-3 ngày",
    updatedAt: new Date().toISOString()
  };
}

export function createTestManager(
  h: TempDbHarness,
  opts?: { maxConcurrentLives?: number; maxHardwareRuntimes?: number }
): MultiLiveRuntimeManager {
  // Tests exercise SPEAK; production default ASSIST_ONLY would mute TTS.
  const ensure = h.accountLiveSettings.ensure.bind(h.accountLiveSettings);
  h.accountLiveSettings.ensure = (accountId: string) => {
    const s = ensure(accountId);
    if (s.outputMode === "ASSIST_ONLY") {
      return h.accountLiveSettings.upsert({ accountId, outputMode: "VOICE_ONLY" });
    }
    return s;
  };

  return new MultiLiveRuntimeManager({
    accounts: h.accounts,
    accountLiveSettings: h.accountLiveSettings,
    repositories: {
      products: h.products,
      events: h.events,
      approvals: h.approvals,
      sessions: h.sessions,
      accountLiveSettings: h.accountLiveSettings
    },
    llm: new MockLlmProvider(),
    createMedia: (accountId) => new MockMediaProvider(accountId),
    assertProductAccess: () => undefined,
    capacity: createTestLiveCapacity({
      maxConcurrentLives: opts?.maxConcurrentLives ?? 5,
      maxHardwareRuntimes: opts?.maxHardwareRuntimes
    })
  });
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
