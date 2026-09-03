import type { ActionProposal, LiveEvent, LiveState, ProductDNA, RuntimeHealth } from "../../../shared/live-types";

export interface LlmContext {
  event: LiveEvent;
  currentState: LiveState;
  product?: ProductDNA;
  recentSpeech: string[];
}

export interface LlmProvider {
  health(): Promise<RuntimeHealth>;
  listModels(): Promise<string[]>;
  generateActionProposal(context: LlmContext): Promise<ActionProposal>;
}
