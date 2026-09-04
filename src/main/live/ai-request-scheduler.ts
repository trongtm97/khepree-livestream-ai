import { randomUUID } from "node:crypto";
import type { ActionProposal, RuntimeHealth } from "../../shared/live-types";
import { analyzeComment } from "../../shared/comment-priority";
import { detectSalesCommentIntent } from "../../shared/sales-brain";
import type { LlmContext, LlmProvider } from "../connectors/llm/types";

/** Default: one Gemini Web call at a time across all lives. */
export const DEFAULT_AI_MAX_CONCURRENT = 1;
/** Drop jobs that waited this long before Gemini starts (livestream is realtime). */
export const DEFAULT_AI_STALE_MS = 12_000;

export type AiRequestJob = {
  id: string;
  accountId: string;
  sessionId?: string;
  createdAt: number;
  priority: number;
  deadlineAt: number;
  context: LlmContext;
  resolve: (proposal: ActionProposal) => void;
  reject: (error: unknown) => void;
};

export type AiAccountMetrics = {
  queued: number;
  running: number;
  avgWaitMs: number;
  lastRequestAt?: string;
};

export type AiSchedulerMetrics = {
  queueLength: number;
  activeRequests: number;
  averageLatencyMs: number;
  staleDropped: number;
  fallbackCount: number;
  perAccount: Record<string, AiAccountMetrics>;
};

export type AiRequestSchedulerOptions = {
  provider: LlmProvider;
  maxConcurrent?: number;
  staleMs?: number;
  /** Test seam for stale timing. */
  now?: () => number;
};

/**
 * Fair multi-account queue in front of a shared LlmProvider (Gemini).
 * Does not own product/speech/memory — only schedules generateActionProposal.
 */
export class AiRequestScheduler implements LlmProvider {
  private readonly queues = new Map<string, AiRequestJob[]>();
  private readonly accountOrder: string[] = [];
  private readonly activeSessions = new Map<string, string>();
  private readonly waitSamples = new Map<string, number[]>();
  private readonly runningByAccount = new Map<string, number>();
  private readonly lastRequestAt = new Map<string, string>();
  private rrIndex = 0;
  private active = 0;
  private draining = false;
  private staleDropped = 0;
  private fallbackCount = 0;
  private latencySum = 0;
  private latencyCount = 0;
  private readonly maxConcurrent: number;
  private readonly staleMs: number;
  private readonly now: () => number;

  constructor(private readonly opts: AiRequestSchedulerOptions) {
    this.maxConcurrent = Math.max(1, opts.maxConcurrent ?? DEFAULT_AI_MAX_CONCURRENT);
    this.staleMs = Math.max(0, opts.staleMs ?? DEFAULT_AI_STALE_MS);
    this.now = opts.now ?? (() => Date.now());
  }

  /** Track which live session is current for an account (stale session jobs drop). */
  bindSession(accountId: string, sessionId: string): void {
    this.activeSessions.set(accountId.trim(), sessionId);
  }

  unbindSession(accountId: string): void {
    this.activeSessions.delete(accountId.trim());
  }

  /** Cancel queued jobs for one account — does not touch other accounts. */
  cancelAccount(accountId: string): number {
    const id = accountId.trim();
    const queue = this.queues.get(id);
    if (!queue?.length) {
      this.queues.delete(id);
      return 0;
    }
    const jobs = queue.splice(0, queue.length);
    this.queues.delete(id);
    for (const job of jobs) {
      this.fallbackCount += 1;
      job.resolve(canceledProposal(job.context));
    }
    return jobs.length;
  }

  cancelAll(): void {
    for (const id of [...this.queues.keys()]) {
      this.cancelAccount(id);
    }
  }

  getMetrics(): AiSchedulerMetrics {
    let queueLength = 0;
    const perAccount: Record<string, AiAccountMetrics> = {};
    for (const [accountId, queue] of this.queues) {
      queueLength += queue.length;
      const samples = this.waitSamples.get(accountId) ?? [];
      const avgWaitMs =
        samples.length === 0 ? 0 : samples.reduce((a, b) => a + b, 0) / samples.length;
      perAccount[accountId] = {
        queued: queue.length,
        running: this.runningByAccount.get(accountId) ?? 0,
        avgWaitMs,
        lastRequestAt: this.lastRequestAt.get(accountId)
      };
    }
    for (const [accountId, running] of this.runningByAccount) {
      if (perAccount[accountId]) continue;
      const samples = this.waitSamples.get(accountId) ?? [];
      perAccount[accountId] = {
        queued: 0,
        running,
        avgWaitMs:
          samples.length === 0 ? 0 : samples.reduce((a, b) => a + b, 0) / samples.length,
        lastRequestAt: this.lastRequestAt.get(accountId)
      };
    }
    return {
      queueLength,
      activeRequests: this.active,
      averageLatencyMs:
        this.latencyCount === 0 ? 0 : this.latencySum / this.latencyCount,
      staleDropped: this.staleDropped,
      fallbackCount: this.fallbackCount,
      perAccount
    };
  }

  async health(): Promise<RuntimeHealth> {
    return this.opts.provider.health();
  }

  async listModels(): Promise<string[]> {
    return this.opts.provider.listModels();
  }

  async generateActionProposal(context: LlmContext): Promise<ActionProposal> {
    const accountId = context.event.accountId?.trim();
    if (!accountId) {
      return {
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        eventId: context.event.id,
        kind: "ASK_OPERATOR",
        confidence: 1,
        reason: "AI scheduler: COMMENT_ACCOUNT_ID_MISSING",
        riskTags: ["scheduler_error"]
      };
    }

    const createdAt = this.now();
    return new Promise<ActionProposal>((resolve, reject) => {
      const job: AiRequestJob = {
        id: randomUUID(),
        accountId,
        sessionId: context.event.sessionId,
        createdAt,
        priority: priorityForContext(context),
        deadlineAt: createdAt + this.staleMs,
        context,
        resolve,
        reject
      };
      this.enqueue(job);
      this.pump();
    });
  }

  private enqueue(job: AiRequestJob): void {
    let queue = this.queues.get(job.accountId);
    if (!queue) {
      queue = [];
      this.queues.set(job.accountId, queue);
      if (!this.accountOrder.includes(job.accountId)) {
        this.accountOrder.push(job.accountId);
      }
    }
    queue.push(job);
    queue.sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      return a.createdAt - b.createdAt;
    });
  }

  private pump(): void {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.active < this.maxConcurrent) {
        const job = this.pickNext();
        if (!job) break;
        this.startJob(job);
      }
    } finally {
      this.draining = false;
    }
  }

  private pickNext(): AiRequestJob | undefined {
    const n = this.accountOrder.length;
    if (n === 0) return undefined;

    for (let i = 0; i < n; i += 1) {
      const idx = (this.rrIndex + i) % n;
      const accountId = this.accountOrder[idx]!;
      const queue = this.queues.get(accountId);
      if (!queue?.length) continue;

      const job = queue.shift()!;
      if (queue.length === 0) this.queues.delete(accountId);
      this.rrIndex = (idx + 1) % n;
      return job;
    }
    return undefined;
  }

  private isJobSessionActive(job: AiRequestJob): boolean {
    if (!job.sessionId) return true;
    const activeSession = this.activeSessions.get(job.accountId);
    return Boolean(activeSession && activeSession === job.sessionId);
  }

  private discardStaleJob(job: AiRequestJob, reason: string): void {
    this.staleDropped += 1;
    this.fallbackCount += 1;
    console.info("[AI_STALE_RESULT_DROPPED]", {
      accountId: job.accountId,
      oldSessionId: job.sessionId,
      currentSessionId: this.activeSessions.get(job.accountId)
    });
    job.resolve(staleProposal(job.context, reason));
  }

  private startJob(job: AiRequestJob): void {
    if (job.sessionId && !this.isJobSessionActive(job)) {
      const activeSession = this.activeSessions.get(job.accountId);
      const reason = activeSession ? "session_mismatch" : "session_ended";
      this.discardStaleJob(job, reason);
      queueMicrotask(() => this.pump());
      return;
    }

    if (this.now() > job.deadlineAt) {
      this.staleDropped += 1;
      this.fallbackCount += 1;
      job.resolve(staleProposal(job.context, "stale_timeout"));
      queueMicrotask(() => this.pump());
      return;
    }

    this.active += 1;
    this.runningByAccount.set(
      job.accountId,
      (this.runningByAccount.get(job.accountId) ?? 0) + 1
    );
    const waitMs = Math.max(0, this.now() - job.createdAt);
    const samples = this.waitSamples.get(job.accountId) ?? [];
    samples.push(waitMs);
    if (samples.length > 50) samples.shift();
    this.waitSamples.set(job.accountId, samples);
    this.lastRequestAt.set(job.accountId, new Date(this.now()).toISOString());

    const started = this.now();
    void this.opts.provider
      .generateActionProposal(job.context)
      .then((proposal) => {
        this.latencySum += Math.max(0, this.now() - started);
        this.latencyCount += 1;
        if (job.sessionId && !this.isJobSessionActive(job)) {
          this.discardStaleJob(job, "session_ended");
          return;
        }
        job.resolve(proposal);
      })
      .catch((error) => {
        job.reject(error);
      })
      .finally(() => {
        this.active = Math.max(0, this.active - 1);
        const running = (this.runningByAccount.get(job.accountId) ?? 1) - 1;
        if (running <= 0) this.runningByAccount.delete(job.accountId);
        else this.runningByAccount.set(job.accountId, running);
        this.pump();
      });
  }
}

export function priorityForContext(context: LlmContext): number {
  if (context.event.type === "ORDER_ACTIVITY") return 100;

  const sales = context.detectedIntent ?? detectSalesCommentIntent(context.event);
  if (sales === "PURCHASE_INTENT") return 100;
  if (sales === "OBJECTION") return 70;

  const comment = analyzeComment(context.event);
  if (comment.isPurchaseIntent) return 100;
  if (comment.isProductQuestion) return 60;
  if (sales === "PRICE_QUESTION" || sales === "SIZE_QUESTION" || sales === "SHIPPING_QUESTION") {
    return 60;
  }
  return 20;
}

function staleProposal(context: LlmContext, reason: string): ActionProposal {
  return {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    eventId: context.event.id,
    kind: "IGNORE",
    confidence: 1,
    reason: `AI scheduler dropped stale request (${reason})`,
    riskTags: ["scheduler_stale", reason]
  };
}

function canceledProposal(context: LlmContext): ActionProposal {
  return {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    eventId: context.event.id,
    kind: "IGNORE",
    confidence: 1,
    reason: "AI scheduler canceled queued request (live stopped or session ended)",
    riskTags: ["scheduler_canceled"]
  };
}
