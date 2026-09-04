import { EventEmitter } from "node:events";
import type { LiveEvent } from "../../shared/live-types";

export type LiveEventBusError = { event: LiveEvent; error: unknown };

/**
 * Fan-out for normalized LiveEvents.
 *
 * A livestream runs for hours and every subscriber (orchestrator, comment feed,
 * persistence) is on the hot path. One throwing subscriber must never take down
 * the main process, so handler failures are isolated and surfaced through
 * `onError` instead of escaping as an unhandled rejection.
 */
export class LiveEventBus {
  private readonly emitter = new EventEmitter();
  private readonly errorHandlers = new Set<(err: LiveEventBusError) => void>();

  constructor() {
    // Many subscribers are attached over a long session; the default cap of 10
    // would emit spurious leak warnings.
    this.emitter.setMaxListeners(0);
  }

  publish(event: LiveEvent): void {
    this.emitter.emit("event", event);
  }

  subscribe(handler: (event: LiveEvent) => void | Promise<void>): () => void {
    const wrapped = (event: LiveEvent): void => {
      try {
        const result = handler(event);
        if (result && typeof (result as Promise<void>).then === "function") {
          void Promise.resolve(result).catch((error: unknown) => {
            this.reportError(event, error);
          });
        }
      } catch (error) {
        this.reportError(event, error);
      }
    };
    this.emitter.on("event", wrapped);
    return () => this.emitter.off("event", wrapped);
  }

  /** Observe subscriber failures (logging, health, telemetry). */
  onError(handler: (err: LiveEventBusError) => void): () => void {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  private reportError(event: LiveEvent, error: unknown): void {
    console.error(
      `[event-bus] subscriber failed for ${event.type}#${event.id}:`,
      error instanceof Error ? error.message : error
    );
    for (const handler of this.errorHandlers) {
      try {
        handler({ event, error });
      } catch {
        // Never let diagnostics break the bus.
      }
    }
  }
}
