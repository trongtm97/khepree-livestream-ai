import { describe, expect, it } from "vitest";
import { assertMultiLiveDomain } from "../../src/main/db/multi-live-self-check";

describe("database / multi-live domain", () => {
  it("isolates account settings, products, profileKeys, and migrations", () => {
    expect(() => assertMultiLiveDomain()).not.toThrow();
  });
});
