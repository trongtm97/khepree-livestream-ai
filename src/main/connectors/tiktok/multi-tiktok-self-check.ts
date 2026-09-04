/**
 * Multi-account TikTok connector isolation (PROMPT 01).
 *
 * Run: npx --yes tsx src/main/connectors/tiktok/multi-tiktok-self-check.ts
 */
import { randomBytes, randomUUID } from "node:crypto";
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
import type { HttpWorkerProcess } from "../../workers/http-worker-process";
import { TikTokConnectorRegistry } from "./tiktok-connector-registry";
import { shortAccountWorkerId, TikTokWorkerProvider } from "./tiktok-worker-provider";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

type StubWorker = {
  name: string;
  listenPort?: number;
  workerToken?: string;
  crashed: boolean;
  connected: boolean;
  queue: LiveEvent[];
  start(): Promise<void>;
  stop(): Promise<void>;
  request(pathname: string, init?: RequestInit): Promise<Response>;
  readonly baseUrl: string;
};

function makeStubWorker(name: string): StubWorker {
  const stub: StubWorker = {
    name,
    listenPort: undefined,
    workerToken: undefined,
    crashed: false,
    connected: false,
    queue: [],
    async start() {
      this.listenPort = 32000 + Math.floor(Math.random() * 20000);
      this.workerToken = randomBytes(32).toString("hex");
    },
    async stop() {
      this.connected = false;
      this.listenPort = undefined;
      this.workerToken = undefined;
    },
    get baseUrl() {
      if (!this.listenPort) throw new Error(`${this.name} not started`);
      return `http://127.0.0.1:${this.listenPort}`;
    },
    async request(pathname: string, init?: RequestInit): Promise<Response> {
      if (this.crashed) throw new Error(`${this.name} crashed`);
      if (pathname === "/health") {
        return new Response(
          JSON.stringify({
            connected: this.connected,
            dependencyInstalled: true,
            message: this.connected ? "ok" : "ready"
          }),
          { status: 200 }
        );
      }
      if (pathname === "/v1/connect" && init?.method === "POST") {
        this.connected = true;
        return new Response("{}", { status: 200 });
      }
      if (pathname === "/v1/disconnect" && init?.method === "POST") {
        this.connected = false;
        return new Response("{}", { status: 200 });
      }
      if (pathname.startsWith("/v1/events")) {
        const after = Number(new URL(pathname, "http://x").searchParams.get("after") ?? 0);
        const events = this.queue.filter((e) => e.sequence > after);
        this.queue = this.queue.filter((e) => e.sequence <= after);
        return new Response(JSON.stringify({ events }), { status: 200 });
      }
      return new Response("not found", { status: 404 });
    }
  };
  return stub;
}

function commentEvent(text: string, sequence: number): LiveEvent {
  return {
    id: randomUUID(),
    sequence,
    type: "COMMENT",
    source: "tiktoklive",
    timestamp: new Date().toISOString(),
    // Deliberately wrong — connector must overwrite with bound accountId.
    accountId: "SHOULD_NOT_LEAK",
    username: "buyer",
    text
  };
}

export async function assertMultiTikTokIsolation(): Promise<void> {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "khepree-multi-tiktok-"));
  let db: ReturnType<typeof openDatabase> | undefined;
  let multiLive: MultiLiveRuntimeManager | undefined;
  let registry: TikTokConnectorRegistry | undefined;
  const stubs = new Map<string, StubWorker>();

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

    registry = new TikTokConnectorRegistry({
      appRoot: userData,
      accounts,
      multiLive,
      eventBus: new LiveEventBus(),
      createProvider: (accountId) => {
        const stub = makeStubWorker(`tiktok-worker-${shortAccountWorkerId(accountId)}`);
        stubs.set(accountId, stub);
        return new TikTokWorkerProvider({
          appRoot: userData,
          worker: stub as unknown as HttpWorkerProcess
        });
      }
    });

    await registry.connect(a.id);
    await registry.connect(b.id);
    await registry.connect(c.id);

    multiLive.startLive(a.id);
    multiLive.startLive(b.id);
    multiLive.startLive(c.id);

    const connA = registry.get(a.id)!;
    const connB = registry.get(b.id)!;
    const connC = registry.get(c.id)!;

    assert(connA.accountId === a.id, "A bound");
    assert(connB.accountId === b.id, "B bound");
    assert(connC.accountId === c.id, "C bound");

    const stubA = stubs.get(a.id)!;
    const stubB = stubs.get(b.id)!;
    assert(stubA.listenPort !== stubB.listenPort, "A/B ports must differ");
    assert(stubA.workerToken !== stubB.workerToken, "A/B tokens must differ");
    assert(stubA.name !== stubB.name, "A/B worker names must differ");
    assert(!stubA.name.includes("shop_a"), "worker name must not embed raw username");
    assert(connA.getLastSequence() === 0 && connB.getLastSequence() === 0, "sequences start 0");

    // B focused — must not steal A's events
    multiLive.setFocusedAccountId(b.id);

    connA.ingestWorkerEvent(commentEvent("COMMENT_A", 1));
    connB.ingestWorkerEvent(commentEvent("COMMENT_B", 1));
    connC.ingestWorkerEvent(commentEvent("COMMENT_C", 1));

    assert(received[a.id]!.join(",") === "COMMENT_A", `A got ${received[a.id]}`);
    assert(received[b.id]!.join(",") === "COMMENT_B", `B got ${received[b.id]}`);
    assert(received[c.id]!.join(",") === "COMMENT_C", `C got ${received[c.id]}`);
    assert(connA.getLastSequence() === 1, "A sequence advanced");
    assert(connB.getLastSequence() === 1, "B sequence independent");
    assert(connC.getLastSequence() === 1, "C sequence independent");

    // Focus C — emit A again; still lands on A
    multiLive.setFocusedAccountId(c.id);
    connA.ingestWorkerEvent(commentEvent("COMMENT_A", 2));
    assert(received[a.id]!.join(",") === "COMMENT_A,COMMENT_A", "focus must not reroute");
    assert(received[c.id]!.join(",") === "COMMENT_C", "C unchanged");

    // Disconnect B — A stays connected
    await registry.disconnect(b.id);
    assert(connA.getPublicState().connected, "A still connected after B disconnect");
    assert(!connB.getPublicState().connected, "B disconnected");
    assert(stubA.connected, "stub A still connected");
    assert(!stubB.connected, "stub B disconnected");

    // Crash worker B — A unaffected
    stubB.crashed = true;
    assert(connA.getPublicState().connected, "A still connected after B crash");
    let bHealthFailed = false;
    try {
      await stubB.request("/health");
    } catch {
      bHealthFailed = true;
    }
    assert(bHealthFailed, "B worker must fail when crashed");
    assert(stubA.listenPort != null, "A port still live");

    // Disabled account cannot connect
    accounts.update(c.id, { enabled: false });
    await registry.disposeAccount(c.id);
    let disabled = false;
    try {
      await registry.connect(c.id);
    } catch (err) {
      disabled = err instanceof Error && err.message === "ACCOUNT_DISABLED";
    }
    assert(disabled, "disabled account blocked");

    // Missing account
    let missing = false;
    try {
      await registry.connect("acc_does_not_exist");
    } catch (err) {
      missing = err instanceof Error && err.message === "TIKTOK_ACCOUNT_NOT_FOUND";
    }
    assert(missing, "missing account blocked");

    // connect(A) must use A's username from repository — not B's
    await registry.disposeAccount(a.id);
    await registry.connect(a.id);
    assert(
      registry.get(a.id)!.getPublicState().uniqueId === "@shop_a",
      "connect must use account username from repository"
    );
  } finally {
    await registry?.disposeAll();
    multiLive?.dispose();
    db?.close();
    try {
      fs.rmSync(userData, { recursive: true, force: true });
    } catch {
      /* Windows sqlite lock */
    }
  }
}

const entry = process.argv[1] ?? "";
if (/multi-tiktok-self-check\.(ts|js)$/.test(entry.replace(/\\/g, "/"))) {
  assertMultiTikTokIsolation()
    .then(() => console.log("multi-tiktok self-check PASS"))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
