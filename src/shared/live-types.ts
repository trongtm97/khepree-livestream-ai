import type { AccountTikTokState } from "./tiktok-contracts";
import type { AccountLiveManagerState } from "./live-manager-contracts";

export type AutomationMode =
  | "MANUAL_ASSIST"
  | "ASSISTED"
  | "SUPERVISED_AUTO"
  | "FULL_AUTO";

export type LiveState =
  | "IDLE"
  | "WELCOME"
  | "PRODUCT_INTRO"
  | "FEATURE"
  | "BENEFIT"
  | "DEMO"
  | "SOCIAL_PROOF"
  | "PRICE"
  | "OBJECTION"
  | "COMMENT_REPLY"
  | "ORDER_REACTION"
  | "CTA"
  | "PRODUCT_SWITCH"
  | "PAUSED";

export type LiveEventType =
  | "COMMENT"
  | "LIKE"
  | "FOLLOW"
  | "SHARE"
  | "GIFT"
  | "VIEWER_COUNT"
  | "ORDER_ACTIVITY"
  | "VIOLATION"
  | "PRODUCT_ACTIVITY"
  | "CONNECT"
  | "DISCONNECT"
  | "SYSTEM";

/**
 * Persistent TikTok seller account (exists whether or not LIVE).
 * No passwords / raw cookies here — browser profile lives on disk under profileKey.
 */
export interface TikTokAccount {
  id: string;
  username: string;
  displayName?: string;
  label?: string;
  /** Filesystem-safe immutable key for browser-profiles/<profileKey>. */
  profileKey: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastConnectedAt?: string;
}

/** Per-account live automation settings (isolated from other accounts). */
export interface AccountLiveSettings {
  accountId: string;
  automationMode: AutomationMode;
  currentProductId?: string;
  mediaProfileId?: string;
  enabled: boolean;
  updatedAt: string;
}

/** One livestream run. An account has many historical sessions; at most one active. */
export type LiveSessionStatus = "RUNNING" | "ENDED" | "ABORTED" | "CRASH_RECOVERED";

export interface LiveSession {
  id: string;
  accountId: string;
  startedAt: string;
  endedAt?: string;
  automationMode: AutomationMode;
  finalState?: string;
  status?: LiveSessionStatus;
}

/** Marked on app startup when a prior process left ended_at NULL. */
export const LIVE_SESSION_CRASH_RECOVERED = "CRASH_RECOVERED";
export const LIVE_SESSION_ABORTED = "ABORTED";

/** Operator-facing per-account live status (MultiLiveRuntimeManager snapshots). */
export interface AccountLiveSnapshot {
  accountId: string;
  username: string;
  label?: string;
  isRunning: boolean;
  sessionId?: string;
  /** ISO timestamp when this process started the current live (for elapsed UI). */
  liveStartedAt?: string;
  state: string;
  automationMode: AutomationMode;
  currentProductId?: string;
  pendingApprovalCount: number;
  health: RuntimeHealth;
  /** Per-account TikTok connector state when registry has one. */
  tiktok?: AccountTikTokState;
  /** Per-account LIVE Manager browser state when registry has one. */
  liveManager?: AccountLiveManagerState;
}

/**
 * Transitional stamp when a connector has not yet wired a real TikTokAccount.
 * Multi-live runtime must replace this before events cross account boundaries.
 */
export const UNASSIGNED_ACCOUNT_ID = "acc_unassigned";

/** Legacy UI fallback only — real caps from Khepree `max_concurrent_lives` (fail-closed). */
export const DEFAULT_MAX_CONCURRENT_LIVES = 5;

export interface LiveEvent {
  id: string;
  sequence: number;
  type: LiveEventType;
  source: "tiktoklive" | "live-manager" | "operator" | "system";
  timestamp: string;
  /** Provenance: which TikTokAccount produced this event. Required. */
  accountId: string;
  /** Provenance: which LiveSession (when live). */
  sessionId?: string;
  userId?: string;
  username?: string;
  displayName?: string;
  text?: string;
  amount?: number;
  productRef?: string;
  /** Dedup key for repeated DOM/activity scans. */
  fingerprint?: string;
  /** 0–1; order DOM defaults low unless payment is proven in UI text. */
  confidence?: number;
  /** Provenance for activity signals (e.g. live-manager-dom). */
  activitySource?: string;
  /**
   * Only true when UI text clearly proves payment.
   * Order rows are activity signals — never invent payment-confirmed.
   */
  paymentConfirmed?: boolean;
  raw?: unknown;
}

export type ActionKind =
  | "SPEAK"
  | "SET_SCENE"
  | "PIN_PRODUCT"
  | "THANK_USER"
  | "ASK_OPERATOR"
  | "IGNORE";

export interface ActionProposal {
  id: string;
  createdAt: string;
  eventId?: string;
  kind: ActionKind;
  speech?: string;
  scene?: string;
  productRef?: string;
  confidence: number;
  reason: string;
  riskTags: string[];
  nextState?: LiveState;
  metadata?: Record<string, unknown>;
}

export type ApprovalStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "EXPIRED"
  | "EXECUTED"
  | "FAILED";

export interface ApprovalItem {
  id: string;
  proposal: ActionProposal;
  status: ApprovalStatus;
  createdAt: string;
  autoApproveAt?: string;
  resolvedAt?: string;
  operatorNote?: string;
  /** Provenance for multi-live query/diagnostics. */
  accountId?: string;
  sessionId?: string;
}

export interface ProductVariant {
  name: string;
  values: string[];
}

export interface ProductFaq {
  question: string;
  answer: string;
}

export interface ProductDNA {
  id: string;
  title: string;
  sourceUrl?: string;
  description?: string;
  priceText?: string;
  currency?: string;
  /** Điểm nổi bật — AI chỉ được nêu khi có trong DNA. */
  facts: string[];
  benefits: string[];
  materials?: string;
  sizes: string[];
  colors: string[];
  variants: ProductVariant[];
  stockText?: string;
  shippingText?: string;
  warrantyText?: string;
  faq: ProductFaq[];
  allowedClaims: string[];
  forbiddenClaims: string[];
  /** Ghi chú nội bộ cho AI (không đọc nguyên văn cho khách nếu không phù hợp). */
  aiNotes?: string;
  updatedAt: string;
}

export interface RuntimeHealth {
  component: string;
  status: "OK" | "DEGRADED" | "DOWN" | "DISABLED";
  message?: string;
  latencyMs?: number;
  checkedAt: string;
}
