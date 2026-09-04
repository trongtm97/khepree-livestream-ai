import type { AppEvent, AppEventType } from "../../shared/app-events";

export type SnapshotSyncDeps = {
  refreshFull: () => Promise<void>;
  refreshComments: () => Promise<void>;
  refreshHealth: () => Promise<void>;
  /** Coalesce window for bursty events (comments). */
  coalesceMs?: number;
  /** Slow full sync if event channel is quiet / fails. */
  fallbackMs?: number;
  /** Health probes — slower than UI events. */
  healthMs?: number;
  now?: () => number;
};

export type SnapshotSyncStats = {
  fullRefreshes: number;
  commentRefreshes: number;
  healthRefreshes: number;
  eventsSeen: number;
};

/**
 * Debounces realtime AppEvents into scoped refreshes.
 * 100 COMMENT_RECEIVED → one comments fetch, not 100 full snapshots.
 */
export function createSnapshotSyncController(deps: SnapshotSyncDeps) {
  const coalesceMs = deps.coalesceMs ?? 100;
  const fallbackMs = deps.fallbackMs ?? 12_000;
  const healthMs = deps.healthMs ?? 8_000;
  const stats: SnapshotSyncStats = {
    fullRefreshes: 0,
    commentRefreshes: 0,
    healthRefreshes: 0,
    eventsSeen: 0
  };

  let pending = new Set<AppEventType>();
  let coalesceTimer: ReturnType<typeof setTimeout> | undefined;
  let fallbackTimer: ReturnType<typeof setInterval> | undefined;
  let healthTimer: ReturnType<typeof setInterval> | undefined;
  let flushing = false;

  async function flush(): Promise<void> {
    if (flushing) return;
    const types = pending;
    pending = new Set();
    if (types.size === 0) return;
    flushing = true;
    try {
      const onlyComments = [...types].every((t) => t === "COMMENT_RECEIVED");
      if (onlyComments) {
        stats.commentRefreshes += 1;
        await deps.refreshComments();
      } else {
        stats.fullRefreshes += 1;
        await deps.refreshFull();
      }
    } finally {
      flushing = false;
    }
  }

  function handleEvent(event: AppEvent): void {
    stats.eventsSeen += 1;
    pending.add(event.type);
    if (coalesceTimer) clearTimeout(coalesceTimer);
    coalesceTimer = setTimeout(() => {
      void flush();
    }, coalesceMs);
  }

  function start(): () => void {
    fallbackTimer = setInterval(() => {
      stats.fullRefreshes += 1;
      void deps.refreshFull();
    }, fallbackMs);
    healthTimer = setInterval(() => {
      stats.healthRefreshes += 1;
      void deps.refreshHealth();
    }, healthMs);
    return () => stop();
  }

  function stop(): void {
    if (coalesceTimer) clearTimeout(coalesceTimer);
    if (fallbackTimer) clearInterval(fallbackTimer);
    if (healthTimer) clearInterval(healthTimer);
    coalesceTimer = undefined;
    fallbackTimer = undefined;
    healthTimer = undefined;
    pending.clear();
  }

  /** Test seam: flush pending immediately. */
  async function flushNow(): Promise<void> {
    if (coalesceTimer) clearTimeout(coalesceTimer);
    coalesceTimer = undefined;
    await flush();
  }

  return {
    handleEvent,
    start,
    stop,
    flushNow,
    getStats: () => ({ ...stats })
  };
}
