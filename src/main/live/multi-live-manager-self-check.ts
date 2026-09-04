/**
 * MultiLiveRuntimeManager self-check (PROMPT MULTI-LIVE 03).
 *
 * Run: npx --yes tsx src/main/live/multi-live-manager-self-check.ts
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

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

export function assertMultiLiveManager(): void {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "khepree-mlm-"));
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
    const d = accounts.create({ username: "shop_d", label: "D" });
    const e = accounts.create({ username: "shop_e", label: "E" });
    assert(accounts.list().length === 5, "need 5 accounts");

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
      maxConcurrentLives: 5
    });

    // Production-style: no accountId → fail (packaged)
    let required = false;
    try {
      manager.resolveAccountIdForLegacyIpc(undefined, { isPackaged: true });
    } catch (err) {
      required = err instanceof Error && err.message === "ACCOUNT_ID_REQUIRED";
    }
    assert(required, "packaged IPC must require accountId");

    // Map isolation: distinct runtimes
    manager.ensureRuntime(a.id);
    manager.ensureRuntime(b.id);
    assert(manager.getRuntime(a.id) !== manager.getRuntime(b.id), "distinct runtime instances");
    assert(manager.listRuntimes().length === 2, "2 ensured runtimes");

    manager.startLive(a.id);
    manager.startLive(b.id);
    manager.startLive(c.id);

    assert(manager.getSnapshot(a.id).isRunning, "A running");
    assert(manager.getSnapshot(b.id).isRunning, "B running");
    assert(manager.getSnapshot(c.id).isRunning, "C running");
    assert(!manager.getSnapshot(d.id).isRunning, "D stopped");
    assert(!manager.getSnapshot(e.id).isRunning, "E stopped");
    assert(manager.countRunning() === 3, "3 active");

    const sessionA = manager.getSnapshot(a.id).sessionId;
    const sessionC = manager.getSnapshot(c.id).sessionId;

    manager.stopLive(b.id);
    assert(!manager.getSnapshot(b.id).isRunning, "B stopped");
    assert(manager.getSnapshot(a.id).isRunning, "A unaffected");
    assert(manager.getSnapshot(c.id).isRunning, "C unaffected");
    assert(manager.getSnapshot(a.id).sessionId === sessionA, "A session stable");
    assert(manager.getSnapshot(c.id).sessionId === sessionC, "C session stable");
    assert(manager.countRunning() === 2, "2 after stop B");

    manager.startLive(d.id);
    const active = manager
      .getAllSnapshots()
      .filter((s) => s.isRunning)
      .map((s) => s.accountId)
      .sort();
    assert(
      active.join(",") === [a.id, c.id, d.id].sort().join(","),
      `active should be A/C/D, got ${active}`
    );

    manager.stopAll();
    assert(manager.countRunning() === 0, "stopAll clears all");
    for (const id of [a.id, b.id, c.id, d.id, e.id]) {
      assert(!manager.getSnapshot(id).isRunning, `${id} must be stopped`);
    }

    // stopAll must not dispose manager — can start again
    manager.startLive(e.id);
    assert(manager.getSnapshot(e.id).isRunning, "E restart after stopAll");
    manager.stopLive(e.id);

    // Disabled account rejected
    accounts.update(e.id, { enabled: false });
    let disabled = false;
    try {
      manager.startLive(e.id);
    } catch (err) {
      disabled = err instanceof Error && err.message === "ACCOUNT_DISABLED";
    }
    assert(disabled, "disabled account must refuse start");

    // Concurrency limit
    const limited = new MultiLiveRuntimeManager({
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
      maxConcurrentLives: 1
    });
    limited.startLive(a.id);
    let limitedHit = false;
    try {
      limited.startLive(b.id);
    } catch (err) {
      limitedHit = err instanceof Error && err.message === "CONCURRENCY_LIMIT";
    }
    assert(limitedHit, "concurrency limit must fire");
    limited.dispose();
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
      /* Windows sqlite lock */
    }
  }
}

const entry = process.argv[1] ?? "";
if (/multi-live-manager-self-check\.(ts|js)$/.test(entry.replace(/\\/g, "/"))) {
  assertMultiLiveManager();
  console.log("multi-live manager self-check PASS");
}
