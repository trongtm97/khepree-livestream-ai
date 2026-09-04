import { describe, expect, it } from "vitest";
import { assertAccountAwareIpc } from "../../src/main/ipc/account-aware-ipc-self-check";

describe("approval / cross-account", () => {
  it("rejects resolving account A approval with account B context", async () => {
    await expect(assertAccountAwareIpc()).resolves.toBeUndefined();
  });
});
