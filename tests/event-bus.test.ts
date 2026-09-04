import { describe, expect, it, vi } from "vitest";
import { LiveEventBus } from "../src/main/core/event-bus";
import { makeComment } from "./helpers/fakes";

describe("LiveEventBus", () => {
  it("delivers events to every subscriber", async () => {
    const bus = new LiveEventBus();
    const a = vi.fn();
    const b = vi.fn();
    bus.subscribe(a);
    bus.subscribe(b);

    const event = makeComment("hello");
    bus.publish(event);
    await Promise.resolve();

    expect(a).toHaveBeenCalledWith(event);
    expect(b).toHaveBeenCalledWith(event);
  });

  it("stops delivering after unsubscribe", () => {
    const bus = new LiveEventBus();
    const handler = vi.fn();
    const off = bus.subscribe(handler);
    bus.publish(makeComment("one"));
    off();
    bus.publish(makeComment("two"));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  // Regression: a throwing subscriber used to escape as an unhandled rejection,
  // which crashes Electron's main process mid-livestream.
  it("isolates a throwing async subscriber", async () => {
    const bus = new LiveEventBus();
    const healthy = vi.fn();
    bus.subscribe(async () => {
      throw new Error("LLM boom");
    });
    bus.subscribe(healthy);

    bus.publish(makeComment("hello"));
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(healthy).toHaveBeenCalledTimes(1);
  });

  it("isolates a throwing sync subscriber", () => {
    const bus = new LiveEventBus();
    const healthy = vi.fn();
    bus.subscribe(() => {
      throw new Error("sync boom");
    });
    bus.subscribe(healthy);

    expect(() => bus.publish(makeComment("hi"))).not.toThrow();
    expect(healthy).toHaveBeenCalledTimes(1);
  });

  it("reports failures through onError without breaking delivery", async () => {
    const bus = new LiveEventBus();
    const seen: string[] = [];
    const healthy = vi.fn();
    bus.onError(({ event, error }) => {
      seen.push(`${event.type}:${(error as Error).message}`);
    });
    bus.subscribe(async () => {
      throw new Error("boom");
    });
    bus.subscribe(healthy);

    bus.publish(makeComment("hi"));
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(seen).toEqual(["COMMENT:boom"]);
    expect(healthy).toHaveBeenCalledTimes(1);
  });

  it("never lets a broken onError handler break the bus", async () => {
    const bus = new LiveEventBus();
    bus.onError(() => {
      throw new Error("diag boom");
    });
    const healthy = vi.fn();
    bus.subscribe(async () => {
      throw new Error("boom");
    });
    bus.subscribe(healthy);

    bus.publish(makeComment("hi"));
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(healthy).toHaveBeenCalledTimes(1);
  });
});
