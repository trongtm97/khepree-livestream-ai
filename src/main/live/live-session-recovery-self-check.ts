/**
 * Live session crash recovery (PROMPT 04).
 *
 * Run: npx --yes tsx src/main/live/live-session-recovery-self-check.ts
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { CURRENT_SCHEMA_VERSION, getSchemaVersion, openDatabase } from "../db/connection";
import {
  AccountLiveSettingsRepository,
  LiveSessionRepository,
  TikTokAccountRepository
} from "../db/repositories";
import { LIVE_SESSION_CRASH_RECOVERED } from "../../shared/live-types";
import { LiveSessionRecoveryService } from "./live-session-recovery";
import { MultiLiveRuntimeManager } from "./multi-live-runtime-manager";
import { createTestLiveCapacity } from "./live-capacity-service";
import { MockLlmProvider } from "../connectors/llm/mock-llm-provider";
import { MockMediaProvider } from "../connectors/media/mock-media-provider";
import {
  ApprovalRepository,
  LiveEventRepository,
  ProductRepository
} from "../db/repositories";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

export function assertLiveSessionRecovery(): void {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "khepree-session-recovery-"));
  let db: ReturnType<typeof openDatabase> | undefined;

  try {
    db = openDatabase(userData);
    assert(getSchemaVersion(db) === CURRENT_SCHEMA_VERSION, "schema v3");
    assert(CURRENT_SCHEMA_VERSION >= 3, "crash recovery requires schema >= 3");

    const sessions = new LiveSessionRepository(db);
    const accounts = new TikTokAccountRepository(db);
    const accountLiveSettings = new AccountLiveSettingsRepository(db);
    const products = new ProductRepository(db);
    const events = new LiveEventRepository(db);
    const approvals = new ApprovalRepository(db);

    const a = accounts.create({ username: "shop_a", label: "A" });
    const b = accounts.create({ username: "shop_b", label: "B" });
    const c = accounts.create({ username: "shop_c", label: "C" });

    // Historical ended session must survive recovery untouched
    const historicalId = `sess_hist_${randomUUID().slice(0, 8)}`;
    sessions.startWithId(historicalId, "SUPERVISED_AUTO", a.id);
    sessions.end(historicalId, "IDLE");
    const histBefore = sessions.get(historicalId)!;
    assert(histBefore.endedAt, "historical ended");
    assert(histBefore.status === "ENDED", "historical status ENDED");

    // Simulate crash: start without stop
    const sessA = `sess_a_${randomUUID().slice(0, 8)}`;
    const sessB = `sess_b_${randomUUID().slice(0, 8)}`;
    const sessC = `sess_c_${randomUUID().slice(0, 8)}`;
    sessions.startWithId(sessA, "SUPERVISED_AUTO", a.id);
    sessions.startWithId(sessB, "SUPERVISED_AUTO", b.id);
    sessions.startWithId(sessC, "SUPERVISED_AUTO", c.id);

    assert(sessions.hasActiveSession(a.id), "A active before crash");
    assert(sessions.hasActiveSession(b.id), "B active before crash");
    assert(sessions.hasActiveSession(c.id), "C active before crash");
    assert(sessions.listOpenSessions().length === 3, "3 open");

    // Simulate restart: reopen DB (same files) and run recovery
    db.close();
    db = openDatabase(userData);
    assert(getSchemaVersion(db) === CURRENT_SCHEMA_VERSION, "reload schema");

    const sessions2 = new LiveSessionRepository(db);
    const accounts2 = new TikTokAccountRepository(db);
    const accountLiveSettings2 = new AccountLiveSettingsRepository(db);
    const products2 = new ProductRepository(db);
    const events2 = new LiveEventRepository(db);
    const approvals2 = new ApprovalRepository(db);

    assert(sessions2.hasActiveSession(a.id), "stale A still open before recovery");

    const recovery = new LiveSessionRecoveryService(sessions2).recoverOnStartup();
    assert(recovery.recoveredCount === 3, `recovered 3, got ${recovery.recoveredCount}`);
    assert(recovery.reason === LIVE_SESSION_CRASH_RECOVERED, "reason");
    assert(recovery.sessionIds.includes(sessA), "A session recovered");
    assert(recovery.sessionIds.includes(sessB), "B session recovered");
    assert(recovery.sessionIds.includes(sessC), "C session recovered");

    assert(!sessions2.hasActiveSession(a.id), "A not active after recovery");
    assert(!sessions2.hasActiveSession(b.id), "B not active after recovery");
    assert(!sessions2.hasActiveSession(c.id), "C not active after recovery");
    assert(sessions2.listOpenSessions().length === 0, "no open sessions");

    const recoveredA = sessions2.get(sessA)!;
    assert(recoveredA.endedAt === recovery.recoveredAt, "ended_at = recovery timestamp");
    assert(recoveredA.finalState === LIVE_SESSION_CRASH_RECOVERED, "final_state preserved marker");
    assert(recoveredA.status === "CRASH_RECOVERED", "status CRASH_RECOVERED");
    assert(sessions2.get(sessB)?.status === "CRASH_RECOVERED", "B status");
    assert(sessions2.get(sessC)?.status === "CRASH_RECOVERED", "C status");

    // Historical row untouched
    const histAfter = sessions2.get(historicalId)!;
    assert(histAfter.endedAt === histBefore.endedAt, "historical ended_at unchanged");
    assert(histAfter.finalState === "IDLE", "historical final_state unchanged");
    assert(histAfter.status === "ENDED", "historical status unchanged");

    // Second recovery is no-op
    const again = new LiveSessionRecoveryService(sessions2).recoverOnStartup();
    assert(again.recoveredCount === 0, "idempotent recovery");

    // A can start a new live session after recovery
    const manager = new MultiLiveRuntimeManager({
      accounts: accounts2,
      accountLiveSettings: accountLiveSettings2,
      repositories: {
        products: products2,
        events: events2,
        approvals: approvals2,
        sessions: sessions2,
        accountLiveSettings: accountLiveSettings2
      },
      llm: new MockLlmProvider(),
      createMedia: () => new MockMediaProvider(),
      assertProductAccess: () => undefined,
      capacity: createTestLiveCapacity({ maxConcurrentLives: 5 })
    });

    const runtime = manager.startLive(a.id);
    assert(runtime.isRunning, "A can start after recovery");
    assert(sessions2.hasActiveSession(a.id), "new session active");
    assert(runtime.sessionId !== sessA, "new session id");
    assert(sessions2.get(sessA)?.endedAt, "old crash session still in history");

    manager.stopLive(a.id);
    manager.dispose();
  } finally {
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

const entry = process.argv[1] ?? "";
if (/live-session-recovery-self-check\.(ts|js)$/.test(entry.replace(/\\/g, "/"))) {
  try {
    assertLiveSessionRecovery();
    console.log("live-session-recovery self-check PASS");
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
