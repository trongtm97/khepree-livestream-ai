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
  | "CONNECT"
  | "DISCONNECT"
  | "SYSTEM";

export interface LiveEvent {
  id: string;
  sequence: number;
  type: LiveEventType;
  source: "tiktoklive" | "live-manager" | "operator" | "system";
  timestamp: string;
  userId?: string;
  username?: string;
  displayName?: string;
  text?: string;
  amount?: number;
  productRef?: string;
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
}

export interface ProductDNA {
  id: string;
  title: string;
  sourceUrl?: string;
  priceText?: string;
  currency?: string;
  variants: Array<{ name: string; values: string[] }>;
  facts: string[];
  benefits: string[];
  allowedClaims: string[];
  forbiddenClaims: string[];
  faq: Array<{ question: string; answer: string }>;
  updatedAt: string;
}

export interface RuntimeHealth {
  component: string;
  status: "OK" | "DEGRADED" | "DOWN" | "DISABLED";
  message?: string;
  latencyMs?: number;
  checkedAt: string;
}
