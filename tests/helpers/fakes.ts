import type {
  ActionProposal,
  LiveEvent,
  LiveState,
  RuntimeHealth
} from "../../src/shared/live-types";
import type { LlmContext, LlmProvider } from "../../src/main/connectors/llm/types";
import type { MediaProvider } from "../../src/main/connectors/media/types";

let sequence = 0;

export function resetSequence(): void {
  sequence = 0;
}

export function makeComment(text: string, username = "viewer1"): LiveEvent {
  sequence += 1;
  return {
    id: `evt-${sequence}`,
    sequence,
    type: "COMMENT",
    source: "tiktoklive",
    timestamp: new Date().toISOString(),
    username,
    displayName: username,
    text
  };
}

export function makeOrder(): LiveEvent {
  sequence += 1;
  return {
    id: `evt-${sequence}`,
    sequence,
    type: "ORDER_ACTIVITY",
    source: "live-manager",
    timestamp: new Date().toISOString()
  };
}

export function makeProposal(overrides: Partial<ActionProposal> = {}): ActionProposal {
  return {
    id: `prop-${Math.random().toString(36).slice(2)}`,
    createdAt: new Date().toISOString(),
    kind: "SPEAK",
    speech: "Mẫu câu trả lời",
    confidence: 0.99,
    reason: "test",
    riskTags: [],
    ...overrides
  };
}

/** LLM stub whose behaviour is fully controlled by the test. */
export class FakeLlmProvider implements LlmProvider {
  calls: LlmContext[] = [];
  private handler: (ctx: LlmContext) => ActionProposal | Promise<ActionProposal>;

  constructor(
    handler: ((ctx: LlmContext) => ActionProposal | Promise<ActionProposal>) | ActionProposal = () =>
      makeProposal()
  ) {
    this.handler = typeof handler === "function" ? handler : () => handler;
  }

  async health(): Promise<RuntimeHealth> {
    return { component: "llm:fake", status: "OK", checkedAt: new Date().toISOString() };
  }

  async listModels(): Promise<string[]> {
    return ["fake-model"];
  }

  async generateActionProposal(context: LlmContext): Promise<ActionProposal> {
    this.calls.push(context);
    return this.handler(context);
  }
}

/** Records everything spoken instead of touching a speaker. */
export class FakeMediaProvider implements MediaProvider {
  spoken: string[] = [];
  scenes: string[] = [];
  stopped = 0;
  failNext = false;

  async health(): Promise<RuntimeHealth> {
    return { component: "media:fake", status: "OK", checkedAt: new Date().toISOString() };
  }

  async speak(text: string): Promise<void> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error("TTS offline");
    }
    this.spoken.push(text);
  }

  async stopSpeech(): Promise<void> {
    this.stopped += 1;
  }

  async setScene(scene: string): Promise<void> {
    this.scenes.push(scene);
  }
}

export function stateAfter(speak: string, nextState?: LiveState): ActionProposal {
  return makeProposal({ speech: speak, nextState });
}
