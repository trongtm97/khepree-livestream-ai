/**
 * License vs hardware capacity (PROMPT 07).
 *
 * Run: npx --yes tsx src/main/live/live-capacity-self-check.ts
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openDatabase } from "../db/connection";
import {
  AccountLiveSettingsRepository,
  ApprovalRepository,
  LiveEventRepository,
  LiveSessionRepository,
  ProductRepository,
  TikTokAccountRepository
} from "../db/repositories";
import { MockLlmProvider } from "../connectors/llm/mock-llm-provider";
import { MockMediaProvider } from "../connectors/media/mock-media-provider";
import { MultiLiveRuntimeManager } from "./multi-live-runtime-manager";
import { createTestLiveCapacity, LiveCapacityService } from "./live-capacity-service";
import { createMockResourceGovernor } from "./resource-governor";
import {
  LIVESTREAM_FEATURE_DEFAULTS,
  resolveLivestreamLicenseLimits
} from "../../shared/khepree-livestream-features";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function withManager(
  capacity: LiveCapacityService,
  fn: (manager: MultiLiveRuntimeManager, ids: string[]) => void
): void {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "khepree-cap-"));
  let db: ReturnType<typeof openDatabase> | undefined;
  let manager: MultiLiveRuntimeManager | undefined;
  try {
    db = openDatabase(userData);
    const products = new ProductRepository(db);
    const events = new LiveEventRepository(db);
    const approvals = new ApprovalRepository(db);
    const sessions = new LiveSessionRepository(db);
    const accounts = new TikTokAccountRepository(db);
    const accountLiveSettings = new AccountLiveSettingsRepository(db);

    const a = accounts.create({ username: "shop_a", label: "A" });
    const b = accounts.create({ username: "shop_b", label: "B" });
    const c = accounts.create({ username: "shop_c", label: "C" });

    manager = new MultiLiveRuntimeManager({
      accounts,
      accountLiveSettings,
      repositories: {
        products,
        events,
        approvals,
        sessions,
        accountLiveSettings
      },
      llm: new MockLlmProvider(),
      createMedia: () => new MockMediaProvider(),
      assertProductAccess: () => undefined,
      capacity
    });

    fn(manager, [a.id, b.id, c.id]);
  } finally {
    manager?.dispose();
    try {
      db?.close();
    } catch {
      /* ignore */
    }
    try {
      fs.rmSync(userData, { recursive: true, force: true });
    } catch {
      /* Windows sqlite */
    }
  }
}

export function assertLiveCapacity(): void {
  // Fail-closed when features absent
  const closed = resolveLivestreamLicenseLimits({});
  assert(closed.multiLiveEnabled === false, "absent multi_live → false");
  assert(closed.maxConcurrentLives === LIVESTREAM_FEATURE_DEFAULTS.maxConcurrentLives, "absent concurrent → 1");
  assert(closed.maxTikTokAccounts === LIVESTREAM_FEATURE_DEFAULTS.maxTikTokAccounts, "absent accounts → 1");

  // License limit = 2: A/B start, C reject; stop A → C start
  withManager(createTestLiveCapacity({ maxConcurrentLives: 2 }), (manager, ids) => {
    const [a, b, c] = ids;
    assert(a && b && c, "need 3 accounts");
    manager.startLive(a);
    manager.startLive(b);
    let rejected = false;
    try {
      manager.startLive(c);
    } catch (err) {
      rejected =
        err instanceof Error && err.message === "LICENSE_MAX_CONCURRENT_LIVES:2";
    }
    assert(rejected, "C must hit license max=2");
    manager.stopLive(a);
    manager.startLive(c);
    assert(manager.getSnapshot(c).isRunning, "C starts after A stopped");
    assert(manager.getSnapshot(b).isRunning, "B still running");
  });

  // Hardware mock = 2, Khepree allows 5 → 3rd is hardware block with correct code
  const hwCapacity = new LiveCapacityService({
    isLicenseActive: () => true,
    getFeatures: () => ({
      "livestream_ai.access": true,
      multi_live_enabled: true,
      max_concurrent_lives: 5,
      max_tiktok_accounts: 10
    }),
    governor: createMockResourceGovernor({ maxRuntimes: 2 })
  });

  withManager(hwCapacity, (manager, ids) => {
    const [a, b, c] = ids;
    assert(a && b && c, "need 3 accounts");
    manager.startLive(a);
    manager.startLive(b);
    const decision = manager.canStartLive(c);
    assert(decision.allowed === false, "3rd not allowed");
    assert(decision.licenseBlockers.length === 0, "license must allow 5");
    assert(
      decision.hardwareBlockers.includes("TOO_MANY_RUNTIMES"),
      "hardware blocker TOO_MANY_RUNTIMES"
    );
    let hwHit = false;
    try {
      manager.startLive(c);
    } catch (err) {
      hwHit = err instanceof Error && err.message === "HARDWARE_TOO_MANY_RUNTIMES";
    }
    assert(hwHit, "start must throw HARDWARE_TOO_MANY_RUNTIMES");
  });

  // Account limit — create path via capacity.assertCanCreateAccount
  const accountCap = createTestLiveCapacity({ maxTikTokAccounts: 2 });
  accountCap.assertCanCreateAccount(0);
  accountCap.assertCanCreateAccount(1);
  let accountHit = false;
  try {
    accountCap.assertCanCreateAccount(2);
  } catch (err) {
    accountHit =
      err instanceof Error && err.message === "LICENSE_MAX_TIKTOK_ACCOUNTS:2";
  }
  assert(accountHit, "11th-style account create must reject at max");

  // RAM_LOW message path
  const ramCap = new LiveCapacityService({
    isLicenseActive: () => true,
    getFeatures: () => ({
      multi_live_enabled: true,
      max_concurrent_lives: 5,
      max_tiktok_accounts: 10
    }),
    governor: createMockResourceGovernor({ maxRuntimes: 99, ramAvailableMb: 100 })
  });
  let ramHit = false;
  try {
    ramCap.assertCanStartLive({
      activeRuntimes: 0,
      activeTikTokWorkers: 0,
      activeBrowserContexts: 0,
      aiQueueLength: 0,
      accountCount: 1
    });
  } catch (err) {
    ramHit = err instanceof Error && err.message === "HARDWARE_RAM_LOW";
  }
  assert(ramHit, "RAM_LOW must throw typed hardware error");
}

const entry = process.argv[1] ?? "";
if (/live-capacity-self-check\.(ts|js)$/.test(entry.replace(/\\/g, "/"))) {
  assertLiveCapacity();
  console.log("live-capacity self-check PASS");
}
