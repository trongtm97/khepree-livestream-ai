/**
 * AiRequestScheduler fairness / cancel / stale (PROMPT 05).
 *
 * Run: npx --yes tsx src/main/live/ai-request-scheduler-self-check.ts
 */
import { randomUUID } from "node:crypto";
import type { ActionProposal, LiveEvent, LiveState } from "../../shared/live-types";
import type { LlmContext, LlmProvider } from "../connectors/llm/types";
import {
  AiRequestScheduler,
  priorityForContext
} from "./ai-request-scheduler";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function contextFor(
  accountId: string,
  text: string,
  sessionId?: string,
  type: LiveEvent["type"] = "COMMENT"
): LlmContext {
  const event: LiveEvent = {
    id: randomUUID(),
    sequence: 1,
    type,
    source: "operator",
    timestamp: new Date().toISOString(),
    accountId,
    sessionId,
    username: "buyer",
    text
  };
  return {
    event,
    currentState: "COMMENT_REPLY" as LiveState,
    recentSpeech: []
  };
}

class RecordingProvider implements LlmProvider {
  readonly started: string[] = [];
  readonly finished: string[] = [];
  delayMs = 5;
  private gate?: Promise<void>;
  private releaseGate?: () => void;

  hold(): void {
    this.gate = new Promise((resolve) => {
      this.releaseGate = resolve;
    });
  }

  release(): void {
    this.releaseGate?.();
    this.gate = undefined;
    this.releaseGate = undefined;
  }

  async health() {
    return {
      component: "llm:recording",
      status: "OK" as const,
      message: "ok",
      checkedAt: new Date().toISOString()
    };
  }

  async listModels() {
    return ["recording"];
  }

  async generateActionProposal(context: LlmContext): Promise<ActionProposal> {
    const id = context.event.accountId;
    this.started.push(id);
    if (this.gate) await this.gate;
    await sleep(this.delayMs);
    this.finished.push(id);
    return {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      eventId: context.event.id,
      kind: "SPEAK",
      speech: `ok-${id}`,
      confidence: 0.9,
      reason: "recording",
      riskTags: []
    };
  }
}

export async function assertAiRequestScheduler(): Promise<void> {
  // Priority helper
  assert(priorityForContext(contextFor("a", "mua ngay")) > priorityForContext(contextFor("a", "hi")), "purchase > general");
  assert(
    priorityForContext(contextFor("a", "x", undefined, "ORDER_ACTIVITY")) >=
      priorityForContext(contextFor("a", "giá bao nhiêu")),
    "order >= product question"
  );

  // --- Fairness: A floods, B/C still get turns ---
  {
    const provider = new RecordingProvider();
    provider.delayMs = 1;
    provider.hold();
    const scheduler = new AiRequestScheduler({
      provider,
      maxConcurrent: 1,
      staleMs: 60_000
    });

    const a = "acc_a";
    const b = "acc_b";
    const c = "acc_c";
    const jobs: Promise<ActionProposal>[] = [];
    for (let i = 0; i < 100; i += 1) jobs.push(scheduler.generateActionProposal(contextFor(a, `A-${i}`)));
    for (let i = 0; i < 5; i += 1) jobs.push(scheduler.generateActionProposal(contextFor(b, `B-${i}`)));
    for (let i = 0; i < 5; i += 1) jobs.push(scheduler.generateActionProposal(contextFor(c, `C-${i}`)));

    await sleep(10);
    assert(scheduler.getMetrics().queueLength >= 100, "queued before release");
    provider.release();
    await Promise.all(jobs);

    assert(provider.finished.length === 110, `finished ${provider.finished.length}`);
    const first30 = provider.started.slice(0, 30);
    assert(first30.includes(b), "B must appear early (no starvation)");
    assert(first30.includes(c), "C must appear early (no starvation)");
    const bCount = provider.finished.filter((x) => x === b).length;
    const cCount = provider.finished.filter((x) => x === c).length;
    assert(bCount === 5 && cCount === 5, "B/C all completed");
  }

  // --- Cancel B mid-queue; A/C continue ---
  {
    const provider = new RecordingProvider();
    provider.delayMs = 20;
    provider.hold();
    const scheduler = new AiRequestScheduler({
      provider,
      maxConcurrent: 1,
      staleMs: 60_000
    });

    const a = "acc_a2";
    const b = "acc_b2";
    const c = "acc_c2";

    const aJobs = Array.from({ length: 8 }, (_, i) =>
      scheduler.generateActionProposal(contextFor(a, `A-${i}`))
    );
    const bJobs = Array.from({ length: 8 }, (_, i) =>
      scheduler.generateActionProposal(contextFor(b, `B-${i}`))
    );
    const cJobs = Array.from({ length: 8 }, (_, i) =>
      scheduler.generateActionProposal(contextFor(c, `C-${i}`))
    );

    await sleep(5);
    const canceled = scheduler.cancelAccount(b);
    assert(canceled >= 1, "B queue canceled");
    provider.release();

    const bResults = await Promise.all(bJobs);
    assert(
      bResults.every((p) => p.kind === "IGNORE" && p.riskTags.includes("scheduler_canceled")),
      "B jobs canceled as IGNORE"
    );

    await Promise.all([...aJobs, ...cJobs]);
    assert(!provider.finished.includes(b) || provider.started.filter((x) => x === b).length <= 1, "B mostly not run");
    assert(provider.finished.includes(a), "A continued");
    assert(provider.finished.includes(c), "C continued");
  }

  // --- Old sessionId does not run after new session bound ---
  {
    const provider = new RecordingProvider();
    provider.delayMs = 5;
    provider.hold();
    const scheduler = new AiRequestScheduler({
      provider,
      maxConcurrent: 1,
      staleMs: 60_000
    });

    const accountId = "acc_sess";
    // Occupy the slot so sess_old stays queued
    const blocker = scheduler.generateActionProposal(contextFor("acc_block2", "block", "sb"));
    scheduler.bindSession(accountId, "sess_old");
    const oldJob = scheduler.generateActionProposal(
      contextFor(accountId, "old comment", "sess_old")
    );
    await sleep(5);
    scheduler.cancelAccount(accountId);
    scheduler.bindSession(accountId, "sess_new");
    const newJob = scheduler.generateActionProposal(
      contextFor(accountId, "new comment", "sess_new")
    );
    provider.release();

    await blocker;
    const oldResult = await oldJob;
    assert(oldResult.kind === "IGNORE", "old session job canceled");
    const newResult = await newJob;
    assert(newResult.kind === "SPEAK", "new session job runs");
    assert(
      provider.finished.filter((x) => x === accountId).length === 1,
      "only new session hit provider for account"
    );
  }

  // --- Stale timeout ---
  {
    let clock = 1_000;
    const provider = new RecordingProvider();
    provider.delayMs = 1;
    provider.hold();
    const scheduler = new AiRequestScheduler({
      provider,
      maxConcurrent: 1,
      staleMs: 50,
      now: () => clock
    });

    // Occupy the single slot with a fresh job, then enqueue a job that will go stale
    const blocker = scheduler.generateActionProposal(contextFor("acc_block", "blocker", "s1"));
    scheduler.bindSession("acc_stale", "s1");
    const staleJob = scheduler.generateActionProposal(contextFor("acc_stale", "too late", "s1"));
    await sleep(5);
    clock += 100; // past deadline before stale job starts
    provider.release();

    await blocker;
    const staleResult = await staleJob;
    assert(staleResult.kind === "IGNORE", "stale → IGNORE");
    assert(staleResult.riskTags.includes("stale_timeout"), "stale_timeout tag");
    assert(scheduler.getMetrics().staleDropped >= 1, "staleDropped metric");
  }

  // Session mismatch: bound session changes before queued job starts
  {
    const provider = new RecordingProvider();
    provider.delayMs = 1;
    provider.hold();
    const scheduler = new AiRequestScheduler({
      provider,
      maxConcurrent: 1,
      staleMs: 60_000
    });
    const accountId = "acc_mismatch";
    scheduler.bindSession(accountId, "sess_1");
    // Occupy slot with another account so mismatch job stays queued
    const blocker = scheduler.generateActionProposal(contextFor("acc_other", "block", "sx"));
    const oldQueued = scheduler.generateActionProposal(contextFor(accountId, "old", "sess_1"));
    await sleep(5);
    scheduler.bindSession(accountId, "sess_2");
    provider.release();
    await blocker;
    const out = await oldQueued;
    assert(out.kind === "IGNORE" && out.riskTags.includes("session_mismatch"), "session mismatch drop");
    assert(!provider.finished.includes(accountId), "old session never hit provider");
  }

  console.log("ai-request-scheduler self-check PASS");
}

const entry = process.argv[1] ?? "";
if (/ai-request-scheduler-self-check\.(ts|js)$/.test(entry.replace(/\\/g, "/"))) {
  assertAiRequestScheduler().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
