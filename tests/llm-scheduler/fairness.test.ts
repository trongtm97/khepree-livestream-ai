import { describe, expect, it } from "vitest";
import { assertAiRequestScheduler } from "../../src/main/live/ai-request-scheduler-self-check";

describe("llm-scheduler / fairness", () => {
  it("round-robins fairly, cancels on unbind, and drops stale jobs", async () => {
    await expect(assertAiRequestScheduler()).resolves.toBeUndefined();
  }, 30_000);
});
