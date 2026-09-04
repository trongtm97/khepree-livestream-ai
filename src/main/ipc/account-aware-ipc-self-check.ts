/**
 * Account-aware IPC / manager contract self-check (PROMPT MULTI-LIVE 04).
 *
 * Run: npx --yes tsx src/main/ipc/account-aware-ipc-self-check.ts
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
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
import { MultiLiveRuntimeManager } from "../live/multi-live-runtime-manager";
import { createTestLiveCapacity } from "../live/live-capacity-service";
import { requireValidAccountId } from "./account-id";
import type { LiveEvent } from "../../shared/live-types";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function comment(accountId: string, text: string, sequence: number): LiveEvent {
  return {
    id: randomUUID(),
    sequence,
    type: "COMMENT",
    source: "operator",
    timestamp: new Date().toISOString(),
    accountId,
    username: "buyer",
    text
  };
}

export async function assertAccountAwareIpc(): Promise<void> {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "khepree-ipc-aware-"));
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

    products.save({
      id: "prod_x",
      title: "X",
      facts: [],
      benefits: [],
      sizes: ["M"],
      colors: [],
      variants: [],
      faq: [],
      allowedClaims: [],
      forbiddenClaims: [],
      priceText: "100",
      shippingText: "fast",
      updatedAt: new Date().toISOString()
    });

    const a = accounts.create({ username: "shop_a", label: "A" });
    const b = accounts.create({ username: "shop_b", label: "B" });

    // Main validation — do not trust renderer
    let missing = false;
    try {
      requireValidAccountId("", accounts);
    } catch (e) {
      missing = e instanceof Error && e.message === "ACCOUNT_ID_REQUIRED";
    }
    assert(missing, "empty accountId must fail");

    let unknown = false;
    try {
      requireValidAccountId("acc_nope", accounts);
    } catch (e) {
      unknown = e instanceof Error && e.message === "TIKTOK_ACCOUNT_NOT_FOUND";
    }
    assert(unknown, "unknown accountId must fail");
    assert(requireValidAccountId(a.id, accounts) === a.id, "valid id passes");

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
      capacity: createTestLiveCapacity({ maxConcurrentLives: 5 })
    });

    manager.setCurrentProduct(a.id, "prod_x");
    manager.setCurrentProduct(b.id, "prod_x");
    manager.setAutomationMode(a.id, "ASSISTED");
    manager.setAutomationMode(b.id, "ASSISTED");

    manager.startLive(a.id);
    manager.startLive(b.id);
    assert(manager.getSnapshot(a.id).isRunning, "A running");
    assert(manager.getSnapshot(b.id).isRunning, "B running");

    manager.stopLive(a.id);
    assert(!manager.getSnapshot(a.id).isRunning, "A stopped");
    assert(manager.getSnapshot(b.id).isRunning, "B still running after stop A");

    const rtB = manager.getRuntime(b.id)!;
    rtB.publishEvent(comment(b.id, "size nào", 1));
    await sleep(80);
    const approvalsB = rtB.listApprovals();
    assert(approvalsB.length >= 1, "B should have approval");
    const approvalId = approvalsB[0]!.id;

    let cross = false;
    try {
      await manager.resolveApproval(a.id, approvalId, "approve");
    } catch (e) {
      cross =
        e instanceof Error &&
        (e.message === "APPROVAL_ACCOUNT_MISMATCH" ||
          e.message === "APPROVAL_NOT_FOUND" ||
          e.message === "LIVE_RUNTIME_NOT_FOUND");
    }
    assert(cross, "resolving B approval with account A must reject");
    assert(
      rtB.listApprovals().some((x) => x.id === approvalId),
      "B approval must remain after cross-account reject"
    );

    await manager.resolveApproval(b.id, approvalId, "reject");
    assert(
      !rtB.listApprovals().some((x) => x.id === approvalId),
      "B can resolve own approval"
    );

    const multi = {
      lives: manager.getAllSnapshots(),
      focusedAccountId: manager.focusedId,
      activeCount: manager.countRunning()
    };
    assert(multi.activeCount === 1, "multi snapshot activeCount");
    assert(multi.lives.length === 2, "multi snapshot lives");
    assert(manager.getSnapshot(b.id).accountId === b.id, "account snapshot");

    manager.setFocusedAccountId(a.id);
    assert(manager.focusedId === a.id, "focus A");
    manager.setFocusedAccountId(b.id);
    assert(manager.focusedId === b.id, "focus B");
    assert(a.profileKey !== b.profileKey, "accounts must have distinct profileKeys");
    assert(
      /^tt_[a-f0-9]+$/i.test(a.profileKey) && /^tt_[a-f0-9]+$/i.test(b.profileKey),
      "profileKey must be filesystem-safe"
    );
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

const entry = process.argv[1] ?? "";
if (/account-aware-ipc-self-check\.(ts|js)$/.test(entry.replace(/\\/g, "/"))) {
  assertAccountAwareIpc()
    .then(() => console.log("account-aware ipc self-check PASS"))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
