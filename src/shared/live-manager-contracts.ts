/** Public LIVE Manager browser connector state — no secrets. */
export type LiveManagerPhase =
  | "CLOSED"
  | "OPENING"
  | "WAITING_LOGIN"
  | "SIGNED_IN"
  | "READY"
  | "ERROR";

export interface LiveManagerPublicState {
  phase: LiveManagerPhase;
  message?: string;
  /** True when comment/order/violation/product selectors are empty. */
  selectorPackEmpty: boolean;
  selectorPackVersion?: string;
  profileDir?: string;
  lastCheckedAt?: string;
  /** Local path of last diagnostic screenshot (never uploaded). */
  lastDiagnosticScreenshot?: string;
  activityFeedConfigured: boolean;
  /** Count of deduped activity events published to the Event Bus. */
  publishedEventCount?: number;
}

/** Per-account LIVE Manager snapshot — no BrowserContext. */
export interface AccountLiveManagerState {
  accountId: string;
  phase: LiveManagerPhase;
  selectorPackVersion?: string;
  activityFeedConfigured: boolean;
  publishedEventCount: number;
  lastCheckedAt?: string;
  message?: string;
  lastDiagnosticScreenshot?: string;
}

export function emptyLiveManagerPublicState(): LiveManagerPublicState {
  return {
    phase: "CLOSED",
    selectorPackEmpty: true,
    activityFeedConfigured: false,
    publishedEventCount: 0
  };
}

export const LIVE_MANAGER_EMPTY_PACK_MESSAGE_VI =
  "Phiên bản giao diện TikTok hiện chưa được cấu hình để đọc Activity Feed.";
export const LIVE_MANAGER_EMPTY_PACK_MESSAGE_EN =
  "This TikTok UI version is not configured yet to read the Activity Feed.";
