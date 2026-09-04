import type { LiveEvent } from "../../shared/live-types";

/**
 * Re-export shared CommentPriority for main live modules.
 * Single implementation lives in `src/shared/comment-priority.ts`.
 */
export {
  analyzeComment,
  scoreComment,
  COMMENT_IMPORTANT_THRESHOLD,
  assertCommentPriorityHelpers,
  type CommentIntent,
  type CommentPriority
} from "../../shared/comment-priority";

/** @deprecated Prefer analyzeComment — kept for call-site clarity in orchestrator. */
export type { LiveEvent };
