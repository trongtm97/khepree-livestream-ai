import type { ActionProposal, ProductDNA } from "../../shared/live-types";
import { applyHallucinationGuard } from "../../shared/sales-brain";
import { ActionProposalModelSchema } from "../../shared/sales-brain/schema";

export interface GuardResult {
  allowed: boolean;
  proposal: ActionProposal;
  reasons: string[];
}

export class PolicyGuard {
  validate(proposal: ActionProposal, product?: ProductDNA): GuardResult {
    const reasons: string[] = [];
    const next = { ...proposal, riskTags: [...proposal.riskTags] };

    if (proposal.kind === "SPEAK" && !proposal.speech?.trim()) {
      reasons.push("Empty speech");
    }

    // Reuse sales-brain hallucination guard (Product DNA grounding).
    const modelParse = ActionProposalModelSchema.safeParse({
      kind: proposal.kind,
      speech: proposal.speech,
      scene: proposal.scene,
      productRef: proposal.productRef,
      confidence: proposal.confidence,
      reason: proposal.reason || "policy",
      riskTags: proposal.riskTags,
      nextState: proposal.nextState
    });
    if (modelParse.success) {
      const grounded = applyHallucinationGuard(modelParse.data, product);
      if (!grounded.ok) {
        reasons.push(...grounded.reasons);
        next.riskTags = [...new Set([...next.riskTags, ...grounded.proposal.riskTags])];
      }
    }

    return { allowed: reasons.length === 0, proposal: next, reasons };
  }
}
