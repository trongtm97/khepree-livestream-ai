import { randomUUID } from "node:crypto";
import type {
  ActionProposal,
  ApprovalItem,
  AutomationMode
} from "../../shared/live-types";

const NEVER_AUTO_RISK_TAGS = new Set([
  "medical",
  "legal",
  "refund",
  "warranty_dispute",
  "unknown_product_fact",
  "regulated_claim"
]);

export interface ApprovalEngineOptions {
  supervisedDelayMs: number;
  confidenceThreshold: number;
}

export class ApprovalEngine {
  private readonly items = new Map<string, ApprovalItem>();

  constructor(private readonly options: ApprovalEngineOptions) {}

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
    return item;
  }

  listPending(): ApprovalItem[] {
    return [...this.items.values()]
      .filter((x) => x.status === "PENDING")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  resolve(
    id: string,
    decision: "approve" | "reject",
    editedSpeech?: string
  ): ApprovalItem {
    const item = this.items.get(id);
    if (!item || item.status !== "PENDING") {
      throw new Error("Approval item not pending");
    }
    if (editedSpeech && item.proposal.kind === "SPEAK") {
      item.proposal = { ...item.proposal, speech: editedSpeech };
    }
    item.status = decision === "approve" ? "APPROVED" : "REJECTED";
    item.resolvedAt = new Date().toISOString();
    return item;
  }

  collectTimedApprovals(now = Date.now()): ApprovalItem[] {
    const due: ApprovalItem[] = [];
    for (const item of this.items.values()) {
      if (
        item.status === "PENDING" &&
        item.autoApproveAt &&
        Date.parse(item.autoApproveAt) <= now
      ) {
        item.status = "APPROVED";
        item.resolvedAt = new Date(now).toISOString();
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

  private canAutoApprove(proposal: ActionProposal, mode: AutomationMode): boolean {
    if (mode !== "SUPERVISED_AUTO" && mode !== "FULL_AUTO") return false;
    if (proposal.confidence < this.options.confidenceThreshold) return false;
    if (proposal.riskTags.some((tag) => NEVER_AUTO_RISK_TAGS.has(tag))) return false;
    return ["SPEAK", "SET_SCENE", "THANK_USER", "IGNORE"].includes(proposal.kind);
  }
}
