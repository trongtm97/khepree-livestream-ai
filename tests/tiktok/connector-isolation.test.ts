import { describe, expect, it } from "vitest";
import { assertMultiTikTokIsolation } from "../../src/main/connectors/tiktok/multi-tiktok-self-check";
import { assertMultiLiveManagerRegistry } from "../../src/main/connectors/tiktok/multi-live-manager-registry-self-check";

describe("tiktok / connector isolation", () => {
  it("keeps workers/ports/tokens independent per account (stub workers)", async () => {
    await expect(assertMultiTikTokIsolation()).resolves.toBeUndefined();
  });
});

describe("tiktok / live-manager registry", () => {
  it("keeps observers and browser profiles independent per account (stub)", async () => {
    await expect(assertMultiLiveManagerRegistry()).resolves.toBeUndefined();
  });
});
