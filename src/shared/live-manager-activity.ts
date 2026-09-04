import type { LiveEvent, LiveEventType } from "./live-types";
import { UNASSIGNED_ACCOUNT_ID } from "./live-types";

export type LiveManagerActivityKind =
  | "COMMENT"
  | "ORDER_ACTIVITY"
  | "VIOLATION"
  | "PRODUCT_ACTIVITY";

export const LIVE_MANAGER_ACTIVITY_SOURCE = "live-manager-dom";

/** Caps remembered fingerprints so long sessions do not grow unbounded. */
export const FINGERPRINT_CACHE_MAX = 2_000;

const PAYMENT_CONFIRMED_MARKERS = [
  "payment confirmed",
  "paid",
  "đã thanh toán",
  "thanh toán thành công",
  "payment success"
] as const;

export function normalizeActivityText(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

export function fingerprintLiveManagerActivity(
  kind: LiveManagerActivityKind,
  text: string,
  username?: string
): string {
  const user = (username ?? "").trim().toLowerCase();
  return `${kind}|${user}|${normalizeActivityText(text)}`;
}

export type OrderActivityAssessment = {
  confidence: number;
  paymentConfirmed: boolean;
  activitySource: typeof LIVE_MANAGER_ACTIVITY_SOURCE;
};

/**
 * Order DOM is an activity signal only.
 * Never claim payment-confirmed unless UI text contains an explicit marker.
 */
export function assessOrderActivity(text: string): OrderActivityAssessment {
  const normalized = normalizeActivityText(text);
  const paymentConfirmed = PAYMENT_CONFIRMED_MARKERS.some((m) =>
    normalized.includes(m)
  );
  return {
    confidence: paymentConfirmed ? 0.85 : 0.4,
    paymentConfirmed,
    activitySource: LIVE_MANAGER_ACTIVITY_SOURCE
  };
}

export type ActivityRowInput = {
  kind: LiveManagerActivityKind;
  text: string;
  username?: string;
  sequence: number;
  timestamp?: string;
  /** Multi-live provenance; defaults to unassigned until connector stamps a real account. */
  accountId?: string;
  sessionId?: string;
};

export function buildLiveManagerActivityEvent(input: ActivityRowInput): LiveEvent {
  const text = input.text.trim();
  const fingerprint = fingerprintLiveManagerActivity(
    input.kind,
    text,
    input.username
  );
  const base: LiveEvent = {
    id: `live-manager-${input.kind.toLowerCase()}-${input.sequence}`,
    sequence: input.sequence,
    type: input.kind as LiveEventType,
    source: "live-manager",
    timestamp: input.timestamp ?? new Date().toISOString(),
    accountId: input.accountId ?? UNASSIGNED_ACCOUNT_ID,
    sessionId: input.sessionId,
    text,
    username: input.username,
    fingerprint,
    activitySource: LIVE_MANAGER_ACTIVITY_SOURCE,
    raw: { kind: input.kind, fingerprint }
  };

  if (input.kind === "ORDER_ACTIVITY") {
    const order = assessOrderActivity(text);
    return {
      ...base,
      confidence: order.confidence,
      paymentConfirmed: order.paymentConfirmed,
      activitySource: order.activitySource,
      raw: {
        kind: input.kind,
        fingerprint,
        signal: order.paymentConfirmed ? "payment_confirmed" : "activity_only"
      }
    };
  }

  if (input.kind === "VIOLATION") {
    return { ...base, confidence: 0.7 };
  }
  if (input.kind === "PRODUCT_ACTIVITY") {
    return { ...base, confidence: 0.5 };
  }
  // COMMENT fallback candidate
  return { ...base, confidence: 0.55 };
}

export class ActivityFingerprintStore {
  private readonly seen = new Set<string>();
  private readonly order: string[] = [];

  has(fingerprint: string): boolean {
    return this.seen.has(fingerprint);
  }

  /** Returns true if newly recorded (not a duplicate). */
  remember(fingerprint: string): boolean {
    if (this.seen.has(fingerprint)) return false;
    this.seen.add(fingerprint);
    this.order.push(fingerprint);
    while (this.order.length > FINGERPRINT_CACHE_MAX) {
      const oldest = this.order.shift();
      if (oldest) this.seen.delete(oldest);
    }
    return true;
  }

  clear(): void {
    this.seen.clear();
    this.order.length = 0;
  }

  get size(): number {
    return this.seen.size;
  }
}

// ponytail: self-check
export function assertLiveManagerActivityHelpers(): void {
  const fp1 = fingerprintLiveManagerActivity("ORDER_ACTIVITY", "  New order  #1 ");
  const fp2 = fingerprintLiveManagerActivity("ORDER_ACTIVITY", "new order #1");
  if (fp1 !== fp2) throw new Error("fingerprint normalize failed");

  const store = new ActivityFingerprintStore();
  if (!store.remember(fp1) || store.remember(fp2)) {
    throw new Error("fingerprint dedup failed");
  }

  const activityOnly = assessOrderActivity("New order from buyer");
  if (activityOnly.paymentConfirmed || activityOnly.confidence >= 0.8) {
    throw new Error("order must stay activity-only without payment markers");
  }

  const paid = assessOrderActivity("Order paid — payment confirmed");
  if (!paid.paymentConfirmed) throw new Error("payment marker not detected");

  const event = buildLiveManagerActivityEvent({
    kind: "ORDER_ACTIVITY",
    text: "New order",
    sequence: 1
  });
  if (event.type !== "ORDER_ACTIVITY" || event.paymentConfirmed) {
    throw new Error("ORDER_ACTIVITY event must not invent paymentConfirmed");
  }
  if (event.activitySource !== LIVE_MANAGER_ACTIVITY_SOURCE) {
    throw new Error("activitySource missing");
  }
  if (!event.fingerprint) throw new Error("fingerprint missing on event");
}
