/**
 * Multi-account LIVE Manager registry isolation (PROMPT 02).
 *
 * Run: npx --yes tsx src/main/connectors/tiktok/multi-live-manager-registry-self-check.ts
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openDatabase } from "../../db/connection";
import {
  AccountLiveSettingsRepository,
  ApprovalRepository,
  LiveEventRepository,
  LiveSessionRepository,
  ProductRepository,
  TikTokAccountRepository
} from "../../db/repositories";
import { LiveEventBus } from "../../core/event-bus";
import { MockLlmProvider } from "../llm/mock-llm-provider";
import { MockMediaProvider } from "../media/mock-media-provider";
import { MultiLiveRuntimeManager } from "../../live/multi-live-runtime-manager";
import { createTestLiveCapacity } from "../../live/live-capacity-service";
import type { LiveEvent } from "../../../shared/live-types";
import { LiveManagerRegistry } from "./live-manager-registry";
import type { LiveManagerObserverFactoryArgs } from "./live-manager-manager";
import type { LiveManagerBrowserStatus, LiveManagerObserver } from "./live-manager-observer";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

/** Minimal observer stub — no Playwright. */
function makeStubObserver(args: LiveManagerObserverFactoryArgs): LiveManagerObserver {
  let status: LiveManagerBrowserStatus = "closed";
  const profileDir = path.join(args.userDataDir, "browser-profiles", args.profileKey);
  const stub = {
    profileDir,
    profileKey: args.profileKey,
    diagnosticsDir: args.diagnosticsDir,
    getBrowserStatus: () => status,
    getLastError: () => undefined as string | undefined,
    getLastDiagnosticScreenshot: () => undefined as string | undefined,
    isPackEmpty: () => true,
    getPackVersion: () => args.pack.version,
    async open() {
      fs.mkdirSync(profileDir, { recursive: true });
      fs.mkdirSync(args.diagnosticsDir, { recursive: true });
      status = "ready";
    },
    async close() {
      status = "closed";
    },
    async scanVisibleEvents() {
      return [] as LiveEvent[];
    },
    async captureDiagnosticScreenshot(reason: string) {
      fs.mkdirSync(args.diagnosticsDir, { recursive: true });
      const file = path.join(args.diagnosticsDir, `live-manager-${reason}-stub.png`);
      fs.writeFileSync(file, "stub");
      return file;
    },
    updateSelectorPack() {
      /* no-op */
    },
    async refreshLoginStatus() {
      return status;
    }
  };
  return stub as unknown as LiveManagerObserver;
}

function orderEvent(text: string, sequence: number): LiveEvent {
  return {
    id: randomUUID(),
    sequence,
    type: "ORDER_ACTIVITY",
    source: "live-manager",
    timestamp: new Date().toISOString(),
    accountId: "SHOULD_NOT_LEAK",
    text,
    confidence: 0.4,
    activitySource: "live-manager-dom"
  };
}

export async function assertMultiLiveManagerRegistry(): Promise<void> {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "khepree-lm-registry-"));
  let db: ReturnType<typeof openDatabase> | undefined;
  let multiLive: MultiLiveRuntimeManager | undefined;
  let registry: LiveManagerRegistry | undefined;

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

    const received: Record<string, string[]> = {
      [a.id]: [],
      [b.id]: [],
      [c.id]: []
    };

    multiLive = new MultiLiveRuntimeManager({
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
      capacity: createTestLiveCapacity({ maxConcurrentLives: 5 }),
      onEvent: (event) => {
        const bucket = received[event.accountId];
        if (bucket && event.text) bucket.push(event.text);

      }
    });

    const observers = new Map<string, LiveManagerObserver>();

    registry = new LiveManagerRegistry({
      accounts,
      multiLive,
      eventBus: new LiveEventBus(),
      userDataDir: userData,
      appRoot: path.resolve(__dirname, "../../../.."),
      createObserver: (args) => {
        const obs = makeStubObserver(args);
        observers.set(args.profileKey, obs);
        return obs;
      }
    });

    await registry.open(a.id);
    await registry.open(b.id);
    await registry.open(c.id);

    assert(observers.size === 3, "three observers created");

    const mgrA = registry.get(a.id)!;
    const mgrB = registry.get(b.id)!;
    const mgrC = registry.get(c.id)!;

    assert(mgrA !== mgrB && mgrB !== mgrC && mgrA !== mgrC, "distinct managers");
    assert(
      mgrA.getObserverForTest() !== mgrB.getObserverForTest(),
      "distinct observer objects"
    );
    assert(
      mgrA.getObserverForTest() !== mgrC.getObserverForTest(),
      "A/C observers distinct"
    );

    const pathA = mgrA.getObserverForTest()!.profileDir.replace(/\\/g, "/");
    const pathB = mgrB.getObserverForTest()!.profileDir.replace(/\\/g, "/");
    const pathC = mgrC.getObserverForTest()!.profileDir.replace(/\\/g, "/");
    assert(pathA !== pathB && pathB !== pathC, "profile paths must differ");
    assert(pathA.endsWith(`browser-profiles/${a.profileKey}`), "A profile path");
    assert(pathB.endsWith(`browser-profiles/${b.profileKey}`), "B profile path");
    assert(!pathA.includes(b.profileKey), "A must not share B profileKey");

    // Diagnostics dirs per accountId
    const diagA = path.join(userData, "diagnostics", "live-manager", a.id);
    const diagB = path.join(userData, "diagnostics", "live-manager", b.id);
    assert(fs.existsSync(diagA), "A diagnostics dir");
    assert(fs.existsSync(diagB), "B diagnostics dir");
    assert(diagA !== diagB, "diagnostics dirs isolated");

    multiLive.startLive(a.id);
    multiLive.startLive(b.id);
    multiLive.startLive(c.id);

    // Focus C — event from A still belongs to A
    multiLive.setFocusedAccountId(c.id);
    mgrA.ingestActivityEvent(orderEvent("ORDER_A", 1));
    mgrB.ingestActivityEvent(orderEvent("ORDER_B", 1));
    mgrC.ingestActivityEvent(orderEvent("ORDER_C", 1));

    assert(received[a.id]!.join(",") === "ORDER_A", `A got ${received[a.id]}`);
    assert(received[b.id]!.join(",") === "ORDER_B", `B got ${received[b.id]}`);
    assert(received[c.id]!.join(",") === "ORDER_C", `C got ${received[c.id]}`);

    const sessionA = multiLive.getSnapshot(a.id).sessionId;
    assert(sessionA, "A has session");

    let stampedSession: string | undefined;
    const rtA = multiLive.getRuntime(a.id)!;
    const unsub = rtA.eventBus.subscribe((ev) => {
      if (ev.text === "ORDER_A2") stampedSession = ev.sessionId;
    });
    mgrA.ingestActivityEvent(orderEvent("ORDER_A2", 2));
    unsub();
    assert(stampedSession === sessionA, "active session stamped on A events");
    assert(received[a.id]!.includes("ORDER_A2"), "A2 received");

    assert(mgrA.getAccountState().publishedEventCount === 2, "A published count");
    assert(mgrB.getAccountState().publishedEventCount === 1, "B published count");

    // Close B — A/C remain
    await registry.close(b.id);
    assert(registry.get(a.id), "A manager still exists");
    assert(registry.get(c.id), "C manager still exists");
    assert(registry.get(b.id), "B manager retained after close (lifecycle entry)");
    assert(mgrA.getPublicState().phase === "READY", "A still ready");
    assert(mgrB.getPublicState().phase === "CLOSED", "B closed");
    assert(mgrC.getPublicState().phase === "READY", "C still ready");

    // Open B again must not close A
    await registry.open(b.id);
    assert(registry.get(a.id) === mgrA, "open B must not recreate A");
    assert(mgrA.getObserverForTest(), "A observer still present");

    // Renderer cannot pass filesystem path — open uses DB profileKey only
    assert(mgrA.profileKey === a.profileKey, "A profileKey from account");
    assert(mgrB.profileKey === b.profileKey, "B profileKey from account");
  } finally {
    await registry?.disposeAll();
    multiLive?.dispose();
    db?.close();
    try {
      fs.rmSync(userData, { recursive: true, force: true });
    } catch {
      /* Windows sqlite */
    }
  }
}

const entry = process.argv[1] ?? "";
if (/multi-live-manager-registry-self-check\.(ts|js)$/.test(entry.replace(/\\/g, "/"))) {
  assertMultiLiveManagerRegistry()
    .then(() => console.log("multi-live-manager-registry self-check PASS"))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
