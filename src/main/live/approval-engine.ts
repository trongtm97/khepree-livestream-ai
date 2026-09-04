import { randomUUID } from "node:crypto";
import type {
  ActionProposal,
  ApprovalItem,
  AutomationMode
} from "../../shared/live-types";

/**
 * Risk tags that must never auto-approve (human-supervised only).
 * Keep aliases so sales-brain / policy / grounding tags all match.
 */
export const NEVER_AUTO_RISK_TAGS = new Set([
  "medical",
  "legal",
  "unknown_fact",
  "unknown_product_fact",
  "missing_product_fact",
  "refund",
  "refund_dispute",
  "warranty",
  "warranty_dispute",
  "regulated_claim"
]);

export interface ApprovalEngineOptions {
  supervisedDelayMs: number;
  confidenceThreshold: number;
  /**
   * Hard cap on items held in memory. A busy livestream produces hundreds of
   * comments per minute; without a cap the map grows for the whole session and
   * `listPending()` degrades linearly because it scans every historical item.
   */
  maxRetained?: number;
  /** Resolved items older than this are dropped on the next prune. */
  resolvedTtlMs?: number;
  /**
   * How long an unanswered item stays actionable.
   *
   * On a livestream a reply drafted ten minutes ago is worse than useless —
   * the viewer has gone. Expiring stale pending items keeps the queue to
   * what the operator can still act on, and stops an ignored console from
   * growing without bound.
   */
  pendingTtlMs?: number;
}

export const DEFAULT_MAX_RETAINED = 400;
export const DEFAULT_RESOLVED_TTL_MS = 10 * 60 * 1000;
export const DEFAULT_PENDING_TTL_MS = 5 * 60 * 1000;

const RESOLVED_STATUSES = new Set<ApprovalItem["status"]>([
  "APPROVED",
  "REJECTED",
  "EXECUTED",
  "FAILED",
  "EXPIRED"
]);

export class ApprovalEngine {
  private readonly items = new Map<string, ApprovalItem>();
  /** Pending ids are tracked separately so hot paths never scan history. */
  private readonly pendingIds = new Set<string>();
  private readonly maxRetained: number;
  private readonly resolvedTtlMs: number;
  private readonly pendingTtlMs: number;

  constructor(private readonly options: ApprovalEngineOptions) {
    this.maxRetained = Math.max(50, options.maxRetained ?? DEFAULT_MAX_RETAINED);
    this.resolvedTtlMs = options.resolvedTtlMs ?? DEFAULT_RESOLVED_TTL_MS;
    this.pendingTtlMs = options.pendingTtlMs ?? DEFAULT_PENDING_TTL_MS;
  }

  get supervisedDelayMs(): number {
    return this.options.supervisedDelayMs;
  }

  /** Diagnostics for the operator console — proves retention is bounded. */
  get size(): number {
    return this.items.size;
  }

  enqueue(proposal: ActionProposal, mode: AutomationMode): ApprovalItem {
    const now = Date.now();
    const item: ApprovalItem = {
      id: randomUUID(),
      proposal,
      status: "PENDING",
      createdAt: new Date(now).toISOString()
    };

    if (this.canAutoApprove(proposal, mode)) {
      item.autoApproveAt = new Date(now + this.options.supervisedDelayMs).toISOString();
    }
    this.items.set(item.id, item);
    this.pendingIds.add(item.id);
    this.prune(now);
    return item;
  }

  listPending(): ApprovalItem[] {
    const pending: ApprovalItem[] = [];
    for (const id of this.pendingIds) {
      const item = this.items.get(id);
      if (item) pending.push(item);
    }
    return pending.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  /**
   * Idempotent by design.
   *
   * The operator clicks "Approve" in the renderer while a SUPERVISED_AUTO
   * countdown may fire at the same moment. Previously the losing side threw
   * "Approval item not pending", so a successful action surfaced as an error
   * dialog. A late click on an already-handled item is now a no-op.
   *
   * @returns the item, or `undefined` when the id is unknown to this session.
   */
  resolve(
    id: string,
    decision: "approve" | "reject",
    editedSpeech?: string
  ): ApprovalItem | undefined {
    const item = this.items.get(id);
    if (!item) return undefined;
    if (item.status !== "PENDING") return item;

    if (
      editedSpeech !== undefined &&
      (item.proposal.kind === "SPEAK" || item.proposal.kind === "THANK_USER")
    ) {
      item.proposal = { ...item.proposal, speech: editedSpeech };
    }
    item.status = decision === "approve" ? "APPROVED" : "REJECTED";
    item.resolvedAt = new Date().toISOString();
    item.autoApproveAt = undefined;
    this.pendingIds.delete(id);
    return item;
  }

  /** Clear countdown but keep item pending for manual action. No-op if settled. */
  cancelAutoApprove(id: string): ApprovalItem | undefined {
    const item = this.items.get(id);
    if (!item || item.status !== "PENDING") return item ?? undefined;
    item.autoApproveAt = undefined;
    return item;
  }

  /** ESC: cancel auto on the soonest pending countdown. */
  cancelNearestAutoApprove(): ApprovalItem | undefined {
    const timed = this.listPending()
      .filter((x) => x.autoApproveAt)
      .sort(
        (a, b) =>
          Date.parse(a.autoApproveAt!) - Date.parse(b.autoApproveAt!)
      );
    const nearest = timed[0];
    if (!nearest) return undefined;
    nearest.autoApproveAt = undefined;
    return nearest;
  }

  /** Stop all pending countdowns (used when operator disables auto). */
  cancelAllAutoApprovals(): number {
    let n = 0;
    for (const id of this.pendingIds) {
      const item = this.items.get(id);
      if (item?.autoApproveAt) {
        item.autoApproveAt = undefined;
        n += 1;
      }
    }
    return n;
  }

  /**
   * Drop every still-pending item — used on emergency stop and session end so
   * stale approvals from a previous livestream never resurface in a new one.
   */
  expirePending(): number {
    let n = 0;
    const now = new Date().toISOString();
    for (const id of [...this.pendingIds]) {
      const item = this.items.get(id);
      if (!item) {
        this.pendingIds.delete(id);
        continue;
      }
      item.status = "EXPIRED";
      item.resolvedAt = now;
      item.autoApproveAt = undefined;
      this.pendingIds.delete(id);
      n += 1;
    }
    return n;
  }

  collectTimedApprovals(now = Date.now()): ApprovalItem[] {
    const due: ApprovalItem[] = [];
    for (const id of [...this.pendingIds]) {
      const item = this.items.get(id);
      if (!item) {
        this.pendingIds.delete(id);
        continue;
      }
      if (item.autoApproveAt && Date.parse(item.autoApproveAt) <= now) {
        item.status = "APPROVED";
        item.resolvedAt = new Date(now).toISOString();
        item.autoApproveAt = undefined;
        this.pendingIds.delete(id);
        due.push(item);
      }
    }
    return due;
  }

  markExecuted(id: string, ok: boolean): void {
    const item = this.items.get(id);
    if (!item) return;
    item.status = ok ? "EXECUTED" : "FAILED";
    item.resolvedAt ??= new Date().toISOString();
    this.pendingIds.delete(id);
    this.prune(Date.now());
  }

  canAutoApprove(proposal: ActionProposal, mode: AutomationMode): boolean {
    if (mode !== "SUPERVISED_AUTO" && mode !== "FULL_AUTO") return false;
    if (proposal.confidence < this.options.confidenceThreshold) return false;
    if (proposal.riskTags.some((tag) => NEVER_AUTO_RISK_TAGS.has(tag.toLowerCase()))) {
      return false;
    }
    return ["SPEAK", "SET_SCENE", "THANK_USER", "IGNORE"].includes(proposal.kind);
  }

  /**
   * Bound memory. Pending items are never dropped (the operator must see them);
   * resolved items are removed oldest-first once over cap or past their TTL.
   */
  private prune(now: number): void {
    // 1. Retire pending items the operator can no longer act on.
    if (this.pendingTtlMs > 0) {
      for (const id of [...this.pendingIds]) {
        const item = this.items.get(id);
        if (!item) {
          this.pendingIds.delete(id);
          continue;
        }
        const createdAt = Date.parse(item.createdAt);
        if (Number.isFinite(createdAt) && now - createdAt > this.pendingTtlMs) {
          item.status = "EXPIRED";
          item.resolvedAt = new Date(now).toISOString();
          item.autoApproveAt = undefined;
          this.pendingIds.delete(id);
        }
      }
    }

    if (this.items.size <= this.maxRetained) {
      // Still evict stale resolved items even under the cap.
      if (this.resolvedTtlMs <= 0 || this.pendingIds.size === this.items.size) return;
    }

    // Insertion order == creation order, so oldest resolved come first.
    for (const [id, item] of this.items) {
      if (this.pendingIds.has(id)) continue;
      if (!RESOLVED_STATUSES.has(item.status)) continue;

      const resolvedAt = item.resolvedAt ? Date.parse(item.resolvedAt) : now;
      const stale = Number.isFinite(resolvedAt) && now - resolvedAt > this.resolvedTtlMs;
      const overCap = this.items.size > this.maxRetained;
      if (stale || overCap) {
        this.items.delete(id);
      } else if (!overCap) {
        // Remaining resolved items are fresh; nothing more to evict by age.
        break;
      }
    }
  }
}

// ponytail: self-check
export function assertApprovalEngineContract(): void {
  const engine = new ApprovalEngine({
    supervisedDelayMs: 3500,
    confidenceThreshold: 0.92
  });
  const medical = engine.canAutoApprove(
    {
      id: "1",
      createdAt: new Date().toISOString(),
      kind: "SPEAK",
      speech: "x",
      confidence: 0.99,
      reason: "t",
      riskTags: ["medical"]
    },
    "SUPERVISED_AUTO"
  );
  if (medical) throw new Error("medical must never auto-approve");

  for (const tag of [
    "legal",
    "unknown_fact",
    "unknown_product_fact",
    "refund_dispute",
    "warranty_dispute"
  ]) {
    const ok = engine.canAutoApprove(
      {
        id: "1",
        createdAt: new Date().toISOString(),
        kind: "SPEAK",
        speech: "x",
        confidence: 0.99,
        reason: "t",
        riskTags: [tag]
      },
      "SUPERVISED_AUTO"
    );
    if (ok) throw new Error(`${tag} must never auto-approve`);
  }

  // Retention must stay bounded over a long stream.
  const bounded = new ApprovalEngine({
    supervisedDelayMs: 1000,
    confidenceThreshold: 0.9,
    maxRetained: 50,
    resolvedTtlMs: 1000
  });
  for (let i = 0; i < 5000; i += 1) {
    const item = bounded.enqueue(
      {
        id: `p${i}`,
        createdAt: new Date().toISOString(),
        kind: "SPEAK",
        speech: "x",
        confidence: 0.99,
        reason: "t",
        riskTags: []
      },
      "SUPERVISED_AUTO"
    );
    bounded.markExecuted(item.id, true);
  }
  if (bounded.size > 60) {
    throw new Error(`approval retention unbounded: ${bounded.size} items held`);
  }
  if (bounded.listPending().length !== 0) {
    throw new Error("executed approvals must not remain pending");
  }

  // Late operator click on an already-resolved item must not throw.
  const race = new ApprovalEngine({ supervisedDelayMs: 3500, confidenceThreshold: 0.9 });
  const pending = race.enqueue(
    {
      id: "r1",
      createdAt: new Date().toISOString(),
      kind: "SPEAK",
      speech: "x",
      confidence: 0.99,
      reason: "t",
      riskTags: []
    },
    "MANUAL_ASSIST"
  );
  race.resolve(pending.id, "approve");
  if (race.resolve(pending.id, "approve")?.status !== "APPROVED") {
    throw new Error("resolve must be idempotent for settled items");
  }
  if (race.resolve("unknown-id", "approve") !== undefined) {
    throw new Error("resolve must return undefined for unknown ids");
  }
}
