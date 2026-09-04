import { describe, expect, it } from "vitest";
import { assertSalesBrainContract } from "../../src/shared/sales-brain/self-check";
import { assertProductDnaHelpers } from "../../src/shared/product-dna";
import { assertCommentPriorityHelpers } from "../../src/shared/comment-priority";
import { assertTikTokAccountHelpers } from "../../src/shared/tiktok-account";
import { assertApprovalEngineContract } from "../../src/main/live/approval-engine";
import { resolveLivestreamLicenseLimits } from "../../src/shared/khepree-livestream-features";

describe("unit / contracts + helpers", () => {
  it("sales brain contract", () => {
    expect(() => assertSalesBrainContract()).not.toThrow();
  });

  it("product DNA helpers", () => {
    expect(() => assertProductDnaHelpers()).not.toThrow();
  });

  it("comment priority helpers", () => {
    expect(() => assertCommentPriorityHelpers()).not.toThrow();
  });

  it("tiktok account helpers", () => {
    expect(() => assertTikTokAccountHelpers()).not.toThrow();
  });

  it("approval engine contract", () => {
    expect(() => assertApprovalEngineContract()).not.toThrow();
  });

  it("fail-closed livestream license defaults when features absent", () => {
    const limits = resolveLivestreamLicenseLimits({});
    expect(limits.multiLiveEnabled).toBe(false);
    expect(limits.maxConcurrentLives).toBe(1);
    expect(limits.maxTikTokAccounts).toBe(1);
  });
});
