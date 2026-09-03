import type { LiveEvent, LiveState } from "../../shared/live-types";

const DEFAULT_ROTATION: LiveState[] = [
  "WELCOME",
  "PRODUCT_INTRO",
  "FEATURE",
  "BENEFIT",
  "DEMO",
  "PRICE",
  "CTA"
];

export class SalesStateMachine {
  private state: LiveState = "IDLE";
  private rotationIndex = 0;

  get current(): LiveState {
    return this.state;
  }

  start(): LiveState {
    this.rotationIndex = 0;
    return this.transition("WELCOME");
  }

  stop(): LiveState {
    return this.transition("IDLE");
  }

  pause(): LiveState {
    return this.transition("PAUSED");
  }

  resume(): LiveState {
    return this.transition("PRODUCT_INTRO");
  }

  onEvent(event: LiveEvent): LiveState {
    if (this.state === "PAUSED" || this.state === "IDLE") return this.state;
    if (event.type === "COMMENT") return this.transition("COMMENT_REPLY");
    if (event.type === "ORDER_ACTIVITY") return this.transition("ORDER_REACTION");
    return this.state;
  }

  advance(): LiveState {
    if (this.state === "PAUSED" || this.state === "IDLE") return this.state;
    this.rotationIndex = (this.rotationIndex + 1) % DEFAULT_ROTATION.length;
    return this.transition(DEFAULT_ROTATION[this.rotationIndex]!);
  }

  transition(next: LiveState): LiveState {
    this.state = next;
    return this.state;
  }
}
