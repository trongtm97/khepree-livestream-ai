import type {
  ActionProposal,
  LiveEvent,
  LiveState,
  ProductDNA,
  RuntimeHealth
} from "../../../shared/live-types";
import type { SalesCommentIntent } from "../../../shared/sales-brain";
import type { MemoryComment } from "../../../shared/live-memory";

export interface LlmContext {
  event: LiveEvent;
  currentState: LiveState;
  product?: ProductDNA;
  recentSpeech: string[];
  recentComments?: MemoryComment[];
  recentRespondedComments?: MemoryComment[];
  recentCta?: string[];
  recentCustomerQuestions?: MemoryComment[];
  lastScene?: string;
  /** Hint when regenerating after near-duplicate speech. */
  antiRepetitionHint?: string;
  policyContext?: {
    forbiddenClaims?: string[];
    allowedClaims?: string[];
    notes?: string[];
  };
  detectedIntent?: SalesCommentIntent;
}

export interface LlmProvider {
  health(): Promise<RuntimeHealth>;
  listModels(): Promise<string[]>;
  generateActionProposal(context: LlmContext): Promise<ActionProposal>;
}
