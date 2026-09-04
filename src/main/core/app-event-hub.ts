import type { AppEvent, AppEventType } from "../../shared/app-events";
import { makeAppEvent } from "../../shared/app-events";
import { IPC } from "../../shared/ipc";

export type AppEventHubOptions = {
  /** Test/override seam — defaults to BrowserWindow.webContents.send. */
  broadcast?: (event: AppEvent) => void;
};

/**
 * Fan-out hub for realtime UI updates.
 * Local subscribers (tests) + optional Electron window broadcast.
 */
export class AppEventHub {
  private readonly listeners = new Set<(event: AppEvent) => void>();
  private readonly broadcast?: (event: AppEvent) => void;
  private emitCount = 0;

  constructor(opts: AppEventHubOptions = {}) {
    this.broadcast = opts.broadcast;
  }

  get emitted(): number {
    return this.emitCount;
  }

  emit(type: AppEventType, accountId?: string): AppEvent {
    const event = makeAppEvent(type, accountId);
    this.emitCount += 1;
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error("[AppEventHub] listener error", error);
      }
    }
    const send = this.broadcast ?? defaultBroadcast;
    try {
      send(event);
    } catch (error) {
      console.error("[AppEventHub] broadcast error", error);
    }
    return event;
  }

  /** Main-side / test subscription (not the preload bridge). */
  subscribe(handler: (event: AppEvent) => void): () => void {
    this.listeners.add(handler);
    return () => this.listeners.delete(handler);
  }
}

function defaultBroadcast(event: AppEvent): void {
  // Lazy require so unit tests without Electron still load.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const electron = require("electron") as typeof import("electron");
  const { BrowserWindow } = electron;
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed() || win.webContents.isDestroyed()) continue;
    win.webContents.send(IPC.APP_EVENT, event);
  }
}
