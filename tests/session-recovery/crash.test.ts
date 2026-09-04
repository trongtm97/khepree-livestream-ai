import { describe, expect, it } from "vitest";
import { assertLiveSessionRecovery } from "../../src/main/live/live-session-recovery-self-check";

describe("session-recovery / crash", () => {
  it("marks stale open sessions CRASH_RECOVERED without auto-resume", () => {
    expect(() => assertLiveSessionRecovery()).not.toThrow();
  });
});
