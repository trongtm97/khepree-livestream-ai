/**
 * LiveRuntime isolation self-check (PROMPT MULTI-LIVE 02).
 *
 * 3 independent runtimes — separate buses/orchestrators/memory/approvals.
 * Run: npx --yes tsx src/main/live/live-runtime-self-check.ts
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
import type { LiveEvent, ProductDNA } from "../../shared/live-types";
import { LiveRuntime } from "./live-runtime";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function sampleProduct(id: string, title: string): ProductDNA {
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

function commentEvent(accountId: string, text: string, sequence: number): LiveEvent {
  return {
    id: randomUUID(),
    sequence,
    type: "COMMENT",
    source: "operator",
    timestamp: new Date().toISOString(),
    accountId,
    username: `buyer_${sequence}`,
    text
  };
}

export async function assertLiveRuntimeIsolation(): Promise<void> {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "khepree-live-runtime-"));
  const runtimes: LiveRuntime[] = [];
  let db: ReturnType<typeof openDatabase> | undefined;
  try {
    db = openDatabase(userData);
    const products = new ProductRepository(db);
    const events = new LiveEventRepository(db);
    const approvals = new ApprovalRepository(db);
    const sessions = new LiveSessionRepository(db);
    const accounts = new TikTokAccountRepository(db);
    const accountLiveSettings = new AccountLiveSettingsRepository(db);

    products.save(sampleProduct("prod_a", "Product A"));
    products.save(sampleProduct("prod_b", "Product B"));
    products.save(sampleProduct("prod_c", "Product C"));

    const accA = accounts.create({ username: "shop_a", label: "A" });
    const accB = accounts.create({ username: "shop_b", label: "B" });
    const accC = accounts.create({ username: "shop_c", label: "C" });

    const repos = {
      products,
      events,
      approvals,
      sessions,
      accountLiveSettings
    };

    const llm = new MockLlmProvider();
    const runtimeA = new LiveRuntime({
      account: accA,
      llm,
      media: new MockMediaProvider(),
      repositories: repos
    });
    const runtimeB = new LiveRuntime({
      account: accB,
      llm,
      media: new MockMediaProvider(),
      repositories: repos
    });
    const runtimeC = new LiveRuntime({
      account: accC,
      llm,
      media: new MockMediaProvider(),
      repositories: repos
    });
    runtimes.push(runtimeA, runtimeB, runtimeC);

    // Separate orchestrator instances (not a shared singleton filter).
    assert(
      runtimeA.eventBus !== runtimeB.eventBus && runtimeB.eventBus !== runtimeC.eventBus,
      "each runtime must own a distinct EventBus"
    );

    runtimeA.setCurrentProduct("prod_a");
    runtimeB.setCurrentProduct("prod_b");
    runtimeC.setCurrentProduct("prod_c");
    runtimeA.setAutomationMode("ASSISTED");
    runtimeB.setAutomationMode("ASSISTED");
    runtimeC.setAutomationMode("ASSISTED");

    assert(runtimeA.currentProductId === "prod_a", "A product");
    assert(runtimeB.currentProductId === "prod_b", "B product");
    assert(runtimeC.currentProductId === "prod_c", "C product");

    runtimeA.start();
    runtimeB.start();
    runtimeC.start();
    assert(runtimeA.isRunning && runtimeB.isRunning && runtimeC.isRunning, "all running");
    assert(runtimeA.sessionId && runtimeB.sessionId && runtimeC.sessionId, "sessions");
    assert(
      runtimeA.sessionId !== runtimeB.sessionId && runtimeB.sessionId !== runtimeC.sessionId,
      "distinct session ids"
    );

    // Foreign event rejected
    let rejected = false;
    try {
      runtimeA.publishEvent(commentEvent(accB.id, "leak", 99));
    } catch (e) {
      rejected = e instanceof Error && e.message === "EVENT_ACCOUNT_MISMATCH";
    }
    assert(rejected, "foreign accountId must reject");

    runtimeA.publishEvent(commentEvent(accA.id, "giá bao nhiêu", 1));
    runtimeB.publishEvent(commentEvent(accB.id, "size nào", 1));
    runtimeC.publishEvent(commentEvent(accC.id, "ship mất bao lâu", 1));

    // Async orchestrator handlers
    await sleep(80);

    const memA = runtimeA.getMemorySnapshot().recentComments.map((c) => c.text);
    const memB = runtimeB.getMemorySnapshot().recentComments.map((c) => c.text);
    const memC = runtimeC.getMemorySnapshot().recentComments.map((c) => c.text);

    assert(memA.length === 1 && memA[0] === "giá bao nhiêu", `A memory wrong: ${memA}`);
    assert(memB.length === 1 && memB[0] === "size nào", `B memory wrong: ${memB}`);
    assert(memC.length === 1 && memC[0] === "ship mất bao lâu", `C memory wrong: ${memC}`);
    assert(!memA.includes("size nào") && !memA.includes("ship mất bao lâu"), "A leaked");
    assert(!memB.includes("giá bao nhiêu") && !memB.includes("ship mất bao lâu"), "B leaked");
    assert(!memC.includes("giá bao nhiêu") && !memC.includes("size nào"), "C leaked");

    const textsA = runtimeA.listApprovals().map((i) => i.proposal.metadata?.viewerText);
    const textsB = runtimeB.listApprovals().map((i) => i.proposal.metadata?.viewerText);
    const textsC = runtimeC.listApprovals().map((i) => i.proposal.metadata?.viewerText);

    assert(!textsA.includes("size nào") && !textsA.includes("ship mất bao lâu"), "A approvals leaked");
    assert(!textsB.includes("giá bao nhiêu") && !textsB.includes("ship mất bao lâu"), "B approvals leaked");
    assert(!textsC.includes("giá bao nhiêu") && !textsC.includes("size nào"), "C approvals leaked");
    // B/C product questions score high → must enqueue; A may be low-score but must not see others
    assert(textsB.includes("size nào"), "B should have size approval");
    assert(textsC.includes("ship mất bao lâu"), "C should have ship approval");

    for (const item of [...runtimeB.listApprovals(), ...runtimeC.listApprovals()]) {
      assert(item.accountId === runtimeB.accountId || item.accountId === runtimeC.accountId, "approval account");
      assert(item.sessionId, "approval sessionId required while live");
    }

    runtimeB.stop();
    assert(!runtimeB.isRunning, "B stopped");
    assert(runtimeA.isRunning && runtimeC.isRunning, "A and C must keep running after B stop");

    // A/C still accept events after B stop
    runtimeA.publishEvent(commentEvent(accA.id, "còn hàng không", 2));
    await sleep(40);
    assert(
      runtimeA.getMemorySnapshot().recentComments.some((c) => c.text === "còn hàng không"),
      "A still accepts events"
    );
    assert(
      !runtimeB.getMemorySnapshot().recentComments.some((c) => c.text === "còn hàng không"),
      "stopped B must not receive A events"
    );
  } finally {
    for (const r of runtimes) r.dispose();
    try {
      db?.close();
    } catch {
      /* ignore */
    }
    try {
      fs.rmSync(userData, { recursive: true, force: true });
    } catch {
      // Windows may keep the sqlite handle briefly; ignore cleanup failures in self-check.
    }
  }
}

const entry = process.argv[1] ?? "";
if (/live-runtime-self-check\.(ts|js)$/.test(entry.replace(/\\/g, "/"))) {
  assertLiveRuntimeIsolation()
    .then(() => console.log("live-runtime isolation self-check PASS"))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
