import type { ActionProposal, ProductDNA } from "../../shared/live-types";

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

    const speech = (proposal.speech ?? "").toLowerCase();
    if (product) {
      for (const forbidden of product.forbiddenClaims) {
        if (forbidden && speech.includes(forbidden.toLowerCase())) {
          reasons.push(`Forbidden product claim: ${forbidden}`);
          next.riskTags.push("regulated_claim");
        }
      }
    }

    if (/\b(chữa khỏi|cure|guaranteed cure|100% hiệu quả)\b/i.test(speech)) {
      reasons.push("High-risk efficacy claim");
      next.riskTags.push("medical");
    }

    return { allowed: reasons.length === 0, proposal: next, reasons };
  }
}
