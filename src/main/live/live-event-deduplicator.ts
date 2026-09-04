import type { LiveEvent } from "../../shared/live-types";

/** Semantic duplicate window (2–4s range). */
export const DEFAULT_DEDUPE_BUCKET_MS = 3_000;
/** How long remembered fingerprints/ids stay valid (30–90s range). */
export const DEFAULT_DEDUPE_TTL_MS = 60_000;
/** Hard cap so a long live cannot grow unbounded. */
export const DEFAULT_DEDUPE_MAX_ENTRIES = 2_000;

export type LiveEventDeduplicatorOptions = {
  ttlMs?: number;
  bucketMs?: number;
  maxEntries?: number;
  /** Test seam for TTL / bucket timing. */
  now?: () => number;
};

export type LiveEventDedupeMetrics = {
  duplicateDropped: number;
  /** e.g. "tiktoklive→live-manager" */
  bySourcePair: Record<string, number>;
};

type CacheEntry = {
  key: string;
  source: LiveEvent["source"];
  expiresAt: number;
};

/**
 * Cross-source dedupe for TikTokLive vs LIVE Manager (and repeats).
 * Scope is always accountId (+ sessionId when present) — never global.
 */
export class LiveEventDeduplicator {
  private readonly byKey = new Map<string, CacheEntry>();
  private readonly order: string[] = [];
  private readonly ttlMs: number;
  private readonly bucketMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;
  private duplicateDropped = 0;
  private readonly bySourcePair: Record<string, number> = {};

  constructor(opts: LiveEventDeduplicatorOptions = {}) {
    this.ttlMs = Math.max(1_000, opts.ttlMs ?? DEFAULT_DEDUPE_TTL_MS);
    this.bucketMs = Math.max(500, opts.bucketMs ?? DEFAULT_DEDUPE_BUCKET_MS);
    this.maxEntries = Math.max(16, opts.maxEntries ?? DEFAULT_DEDUPE_MAX_ENTRIES);
    this.now = opts.now ?? (() => Date.now());
  }

  getMetrics(): LiveEventDedupeMetrics {
    return {
      duplicateDropped: this.duplicateDropped,
      bySourcePair: { ...this.bySourcePair }
    };
  }

  /**
   * @returns true if the event should enter the business pipeline.
   */
  accept(event: LiveEvent): boolean {
    const accountId = event.accountId?.trim();
    if (!accountId) return true;

    const now = this.now();
    this.purgeExpired(now);

    const scope = scopeKey(accountId, event.sessionId);
    const idKey = `id:${scope}:${event.id}`;
    const existingId = this.byKey.get(idKey);
    if (existingId && existingId.expiresAt > now) {
      this.recordDrop(existingId.source, event.source);
      return false;
    }

    const fp = fingerprintLiveEvent(event, this.bucketMs);
    if (fp) {
      const fpKey = `fp:${scope}:${fp}`;
      const existingFp = this.byKey.get(fpKey);
      if (existingFp && existingFp.expiresAt > now && existingFp.source !== event.source) {
        // Cross-source only — same-source polls already dedupe upstream; exact id covers retries.
        this.recordDrop(existingFp.source, event.source);
        return false;
      }
      this.remember(fpKey, event.source, now);
    }

    this.remember(idKey, event.source, now);
    return true;
  }

  clear(): void {
    this.byKey.clear();
    this.order.length = 0;
  }

  private recordDrop(first: LiveEvent["source"], second: LiveEvent["source"]): void {
    this.duplicateDropped += 1;
    const pair = `${first}→${second}`;
    this.bySourcePair[pair] = (this.bySourcePair[pair] ?? 0) + 1;
  }

  private remember(key: string, source: LiveEvent["source"], now: number): void {
    if (this.byKey.has(key)) {
      // Refresh TTL / source for same key
      const prev = this.byKey.get(key)!;
      prev.expiresAt = now + this.ttlMs;
      prev.source = source;
      return;
    }
    this.byKey.set(key, { key, source, expiresAt: now + this.ttlMs });
    this.order.push(key);
    while (this.order.length > this.maxEntries) {
      const oldest = this.order.shift();
      if (oldest) this.byKey.delete(oldest);
    }
  }

  private purgeExpired(now: number): void {
    while (this.order.length > 0) {
      const key = this.order[0]!;
      const entry = this.byKey.get(key);
      if (!entry) {
        this.order.shift();
        continue;
      }
      if (entry.expiresAt > now) break;
      this.byKey.delete(key);
      this.order.shift();
    }
  }
}

function scopeKey(accountId: string, sessionId?: string): string {
  const sid = sessionId?.trim();
  return sid ? `${accountId}|${sid}` : `${accountId}|_`;
}

/** Strip leading @; lowercase handle only (not comment text). */
export function normalizeEventUsername(username?: string): string {
  return (username ?? "").trim().replace(/^@+/, "").toLowerCase();
}

/** Trim + collapse whitespace — preserve case (SKU-safe). */
export function normalizeEventText(text?: string): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Semantic fingerprint for COMMENT / ORDER_ACTIVITY.
 * Returns undefined for types that only use exact event id.
 */
export function fingerprintLiveEvent(
  event: LiveEvent,
  bucketMs = DEFAULT_DEDUPE_BUCKET_MS
): string | undefined {
  if (event.type !== "COMMENT" && event.type !== "ORDER_ACTIVITY") return undefined;

  const user = normalizeEventUsername(event.username);
  const text = normalizeEventText(event.text);
  const ts = Date.parse(event.timestamp);
  const bucket = Number.isFinite(ts) ? Math.floor(ts / bucketMs) : Math.floor(Date.now() / bucketMs);

  if (event.type === "COMMENT") {
    return `COMMENT|${user}|${text}|${bucket}`;
  }

  const productRef = normalizeEventText(event.productRef);
  return `ORDER_ACTIVITY|${user}|${productRef}|${text}|${bucket}`;
}

// ponytail: self-check
export function assertLiveEventDeduplicator(): void {
  const d = new LiveEventDeduplicator({ ttlMs: 60_000, bucketMs: 3_000 });
  const base = {
    sequence: 1,
    type: "COMMENT" as const,
    timestamp: new Date().toISOString(),
    accountId: "a",
    sessionId: "s",
    username: "john",
    text: "gia bao nhieu"
  };
  if (!d.accept({ ...base, id: "1", source: "tiktoklive" })) {
    throw new Error("first accept");
  }
  if (d.accept({ ...base, id: "2", source: "live-manager" })) {
    throw new Error("cross-source should drop");
  }
  if (!d.accept({ ...base, id: "3", source: "tiktoklive", username: "mary" })) {
    throw new Error("different user must pass");
  }
}
