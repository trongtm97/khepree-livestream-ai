import { describe, expect, it } from "vitest";
import {
  ApprovalEngine,
  DEFAULT_MAX_RETAINED,
  NEVER_AUTO_RISK_TAGS
} from "../src/main/live/approval-engine";
import type { ActionProposal } from "../src/shared/live-types";

function engine(over: Partial<ConstructorParameters<typeof ApprovalEngine>[0]> = {}) {
  return new ApprovalEngine({
    supervisedDelayMs: 3500,
    confidenceThreshold: 0.92,
    ...over
  });
}

function proposal(over: Partial<ActionProposal> = {}): ActionProposal {
  return {
    id: "p1",
    createdAt: new Date().toISOString(),
    kind: "SPEAK",
    speech: "Cảm ơn bạn",
    confidence: 0.99,
    reason: "test",
    riskTags: [],
    ...over
  };
}

describe("ApprovalEngine — safety invariants", () => {
  it("never auto-approves protected risk tags", () => {
    const e = engine();
    for (const tag of NEVER_AUTO_RISK_TAGS) {
      expect(e.canAutoApprove(proposal({ riskTags: [tag] }), "SUPERVISED_AUTO")).toBe(false);
    }
  });

  it("is case-insensitive about risk tags", () => {
    const e = engine();
    expect(e.canAutoApprove(proposal({ riskTags: ["MEDICAL"] }), "FULL_AUTO")).toBe(false);
  });

  it("does not auto-approve below the confidence threshold", () => {
    const e = engine();
    expect(e.canAutoApprove(proposal({ confidence: 0.5 }), "SUPERVISED_AUTO")).toBe(false);
    expect(e.canAutoApprove(proposal({ confidence: 0.99 }), "SUPERVISED_AUTO")).toBe(true);
  });

  it("never auto-approves in manual or assisted modes", () => {
    const e = engine();
    expect(e.canAutoApprove(proposal(), "MANUAL_ASSIST")).toBe(false);
    expect(e.canAutoApprove(proposal(), "ASSISTED")).toBe(false);
  });

  it("never auto-approves ASK_OPERATOR or PIN_PRODUCT", () => {
    const e = engine();
    expect(e.canAutoApprove(proposal({ kind: "ASK_OPERATOR" }), "FULL_AUTO")).toBe(false);
    expect(e.canAutoApprove(proposal({ kind: "PIN_PRODUCT" }), "FULL_AUTO")).toBe(false);
  });
});

describe("ApprovalEngine — operator click race", () => {
  it("treats a late click on an auto-approved item as a no-op", () => {
    const e = engine({ supervisedDelayMs: 1 });
    const item = e.enqueue(proposal(), "SUPERVISED_AUTO");
    const fired = e.collectTimedApprovals(Date.now() + 10);
    expect(fired).toHaveLength(1);

    // Operator's click lands just after the countdown fired.
    expect(() => e.resolve(item.id, "approve")).not.toThrow();
    expect(e.resolve(item.id, "approve")?.status).toBe("APPROVED");
  });

  it("returns undefined for ids it has never seen", () => {
    const e = engine();
    expect(e.resolve("nope", "approve")).toBeUndefined();
    expect(e.cancelAutoApprove("nope")).toBeUndefined();
  });

  it("does not report already-executed items as pending", () => {
    const e = engine();
    const item = e.enqueue(proposal(), "MANUAL_ASSIST");
    expect(e.listPending()).toHaveLength(1);
    e.markExecuted(item.id, true);
    expect(e.listPending()).toHaveLength(0);
    expect(item.status).toBe("EXECUTED");
  });
});

describe("ApprovalEngine — bounded retention", () => {
  it("keeps memory bounded across a long livestream", () => {
    const e = engine({ maxRetained: 100, resolvedTtlMs: 1000 });
    for (let i = 0; i < 20_000; i += 1) {
      const item = e.enqueue(proposal({ id: `p${i}` }), "SUPERVISED_AUTO");
      e.markExecuted(item.id, true);
    }
    expect(e.size).toBeLessThanOrEqual(100);
    expect(e.size).toBeLessThan(20_000);
  });

  it("defaults to a sane cap", () => {
    const e = engine();
    for (let i = 0; i < DEFAULT_MAX_RETAINED * 5; i += 1) {
      e.markExecuted(e.enqueue(proposal({ id: `p${i}` }), "MANUAL_ASSIST").id, true);
    }
    expect(e.size).toBeLessThanOrEqual(DEFAULT_MAX_RETAINED);
  });

  it("never drops items the operator still has to act on", () => {
    const e = engine({ maxRetained: 10 });
    for (let i = 0; i < 200; i += 1) e.enqueue(proposal({ id: `p${i}` }), "MANUAL_ASSIST");
    expect(e.listPending()).toHaveLength(200);
  });

  it("stays fast as history accumulates", () => {
    const e = engine();
    for (let i = 0; i < 10_000; i += 1) {
      e.markExecuted(e.enqueue(proposal({ id: `p${i}` }), "SUPERVISED_AUTO").id, true);
    }
    const start = Date.now();
    for (let i = 0; i < 2_000; i += 1) e.listPending();
    expect(Date.now() - start).toBeLessThan(500);
  });
});

describe("ApprovalEngine — countdown control", () => {
  it("cancelNearestAutoApprove clears the soonest countdown only", () => {
    const e = engine({ supervisedDelayMs: 5000 });
    const first = e.enqueue(proposal({ id: "a" }), "SUPERVISED_AUTO");
    const second = e.enqueue(proposal({ id: "b" }), "SUPERVISED_AUTO");
    const cancelled = e.cancelNearestAutoApprove();
    expect(cancelled?.id).toBe(first.id);
    expect(first.autoApproveAt).toBeUndefined();
    expect(second.autoApproveAt).toBeDefined();
  });

  it("cancelAllAutoApprovals clears every countdown but keeps items pending", () => {
    const e = engine();
    e.enqueue(proposal(), "SUPERVISED_AUTO");
    e.enqueue(proposal(), "SUPERVISED_AUTO");
    expect(e.cancelAllAutoApprovals()).toBe(2);
    expect(e.listPending()).toHaveLength(2);
    expect(e.collectTimedApprovals(Date.now() + 60_000)).toHaveLength(0);
  });

  it("expirePending clears the queue and reports how many were dropped", () => {
    const e = engine();
    e.enqueue(proposal(), "SUPERVISED_AUTO");
    e.enqueue(proposal(), "MANUAL_ASSIST");
    expect(e.expirePending()).toBe(2);
    expect(e.listPending()).toHaveLength(0);
  });

  it("applies operator edits to speech before approval", () => {
    const e = engine();
    const item = e.enqueue(proposal({ speech: "bản nháp" }), "MANUAL_ASSIST");
    const resolved = e.resolve(item.id, "approve", "bản đã sửa");
    expect(resolved?.proposal.speech).toBe("bản đã sửa");
  });
});
