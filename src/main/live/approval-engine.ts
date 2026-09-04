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
}

/** Required provenance for live approvals. */
export type ApprovalEnqueueContext = {
  accountId: string;
  sessionId: string;
};

export class ApprovalEngine {
  private readonly items = new Map<string, ApprovalItem>();

  constructor(private readonly options: ApprovalEngineOptions) {}

  get supervisedDelayMs(): number {
    return this.options.supervisedDelayMs;
  }

  enqueue(
    proposal: ActionProposal,
    mode: AutomationMode,
    context: ApprovalEnqueueContext
  ): ApprovalItem {
    const accountId = context.accountId.trim();
    const sessionId = context.sessionId.trim();
    if (!accountId || !sessionId) {
      throw new Error("APPROVAL_SESSION_REQUIRED");
    }

    const now = Date.now();
    const item: ApprovalItem = {
      id: randomUUID(),
      proposal,
      status: "PENDING",
      createdAt: new Date(now).toISOString(),
      accountId,
      sessionId
    };

    if (this.canAutoApprove(proposal, mode)) {
      item.autoApproveAt = new Date(now + this.options.supervisedDelayMs).toISOString();
    }
    this.items.set(item.id, item);
    return item;
  }

  listPending(): ApprovalItem[] {
    return [...this.items.values()]
      .filter((x) => x.status === "PENDING")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  /** Expire all PENDING approvals for a live session (stop live). */
  expireSession(sessionId: string, now = Date.now()): ApprovalItem[] {
    const sid = sessionId.trim();
    if (!sid) return [];
    const expired: ApprovalItem[] = [];
    const resolvedAt = new Date(now).toISOString();
    for (const item of this.items.values()) {
      if (item.status !== "PENDING" || item.sessionId !== sid) continue;
      item.status = "EXPIRED";
      item.resolvedAt = resolvedAt;
      item.autoApproveAt = undefined;
      expired.push(item);
    }
    return expired;
  }

  resolve(
    id: string,
    decision: "approve" | "reject",
    editedSpeech?: string,
    activeSessionId?: string
  ): ApprovalItem {
    const item = this.items.get(id);
    if (!item) {
      throw new Error("APPROVAL_NOT_PENDING");
    }
    if (item.status === "EXPIRED") {
      throw new Error("APPROVAL_SESSION_EXPIRED");
    }
    if (item.status !== "PENDING") {
      throw new Error("APPROVAL_NOT_PENDING");
    }
    if (
      activeSessionId !== undefined &&
      item.sessionId &&
      item.sessionId !== activeSessionId
    ) {
      throw new Error("APPROVAL_SESSION_EXPIRED");
    }
    if (
      editedSpeech !== undefined &&
      (item.proposal.kind === "SPEAK" || item.proposal.kind === "THANK_USER")
    ) {
      item.proposal = { ...item.proposal, speech: editedSpeech };
    }
    item.status = decision === "approve" ? "APPROVED" : "REJECTED";
    item.resolvedAt = new Date().toISOString();
    item.autoApproveAt = undefined;
    return item;
  }

  /** Clear countdown but keep item pending for manual action. */
  cancelAutoApprove(id: string): ApprovalItem {
    const item = this.items.get(id);
    if (!item || item.status !== "PENDING") {
      throw new Error("APPROVAL_NOT_PENDING");
    }
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
  cancelAllAutoApprovals(): ApprovalItem[] {
    const out: ApprovalItem[] = [];
    for (const item of this.items.values()) {
      if (item.status === "PENDING" && item.autoApproveAt) {
        item.autoApproveAt = undefined;
        out.push(item);
      }
    }
    return out;
  }

  /** Expire all PENDING approvals (takeover / emergency — do not speak them later). */
  expireAllPending(now = Date.now()): ApprovalItem[] {
    const out: ApprovalItem[] = [];
    const resolvedAt = new Date(now).toISOString();
    for (const item of this.items.values()) {
      if (item.status === "PENDING") {
        item.status = "EXPIRED";
        item.resolvedAt = resolvedAt;
        item.autoApproveAt = undefined;
        out.push(item);
      }
    }
    return out;
  }

  /**
   * Auto-approve due PENDING items for the active live session only.
   * Never promotes approvals from a prior session.
   */
  collectTimedApprovals(activeSessionId: string, now = Date.now()): ApprovalItem[] {
    const sid = activeSessionId.trim();
    if (!sid) return [];
    const due: ApprovalItem[] = [];
    for (const item of this.items.values()) {
      if (
        item.status === "PENDING" &&
        item.sessionId === sid &&
        item.autoApproveAt &&
        Date.parse(item.autoApproveAt) <= now
      ) {
        item.status = "APPROVED";
        item.resolvedAt = new Date(now).toISOString();
        item.autoApproveAt = undefined;
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
  }

  canAutoApprove(proposal: ActionProposal, mode: AutomationMode): boolean {
    if (mode !== "SUPERVISED_AUTO" && mode !== "FULL_AUTO") return false;
    if (proposal.confidence < this.options.confidenceThreshold) return false;
    if (proposal.riskTags.some((tag) => NEVER_AUTO_RISK_TAGS.has(tag.toLowerCase()))) {
      return false;
    }
    return ["SPEAK", "SET_SCENE", "THANK_USER", "IGNORE"].includes(proposal.kind);
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

  const item = engine.enqueue(
    {
      id: "1",
      createdAt: new Date().toISOString(),
      kind: "SPEAK",
      speech: "hi",
      confidence: 0.99,
      reason: "t",
      riskTags: []
    },
    "MANUAL_ASSIST",
    { accountId: "acc", sessionId: "sess" }
  );
  if (!item.accountId || !item.sessionId) throw new Error("enqueue must stamp provenance");
  const expired = engine.expireSession("sess");
  if (expired.length !== 1 || expired[0]?.status !== "EXPIRED") {
    throw new Error("expireSession must mark PENDING as EXPIRED");
  }
}
