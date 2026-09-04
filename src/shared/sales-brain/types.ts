import type { LiveEvent, LiveState, ProductDNA } from "../live-types";
import type { SalesCommentIntent } from "./schema";
import type { MemoryComment } from "../live-memory";

/** Shared context shape for sales brain (main LlmContext is compatible). */
export interface LlmContextLike {
  event: LiveEvent;
  currentState: LiveState;
  product?: ProductDNA;
  recentSpeech: string[];
  recentComments?: MemoryComment[];
  recentRespondedComments?: MemoryComment[];
  recentCta?: string[];
  recentCustomerQuestions?: MemoryComment[];
  lastScene?: string;
  antiRepetitionHint?: string;
  policyContext?: {
    forbiddenClaims?: string[];
    allowedClaims?: string[];
    notes?: string[];
  };
  detectedIntent?: SalesCommentIntent;
}
