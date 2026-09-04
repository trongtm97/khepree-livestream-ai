import { describe, expect, it } from "vitest";
import { assertCommentFeedMultiLive } from "../../src/main/live/comment-feed-self-check";

describe("comments / feed isolation", () => {
  it("keeps per-account buffers and rejects cross-account ops", () => {
    expect(() => assertCommentFeedMultiLive()).not.toThrow();
  });
});
