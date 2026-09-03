import { EventEmitter } from "node:events";
import type { LiveEvent } from "../../shared/live-types";

export class LiveEventBus {
  private readonly emitter = new EventEmitter();

  publish(event: LiveEvent): void {
    this.emitter.emit("event", event);
  }

  subscribe(handler: (event: LiveEvent) => void | Promise<void>): () => void {
    const wrapped = (event: LiveEvent) => void Promise.resolve(handler(event));
    this.emitter.on("event", wrapped);
    return () => this.emitter.off("event", wrapped);
  }
}
