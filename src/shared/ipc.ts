import type {
  AccountLiveSnapshot,
  ApprovalItem,
  AutomationMode,
  ProductDNA,
  RuntimeHealth,
  TikTokAccount
} from "./live-types";
import type {
  GeminiProbeResult,
  GeminiPublicState,
  GeminiTestResult,
  LlmProviderId
} from "./gemini-contracts";
import type { KhepreePublicState } from "./khepree-contracts";
import type { AppLocale } from "./locale";
import type { OnboardingState } from "./onboarding";
import type { TikTokPublicState } from "./tiktok-contracts";
import type { LiveManagerPublicState } from "./live-manager-contracts";
import type { CommentFeedSnapshot } from "./comment-feed";
import type { LivestreamLicenseLimits } from "./khepree-livestream-features";

/** Operator-facing crash recovery notice after abnormal app exit. */
export interface SessionRecoveryNotice {
  recoveredCount: number;
  recoveredAt: string;
}

export const IPC = {
  APP_SNAPSHOT: "app:snapshot",
  LIVE_START: "live:start",
  LIVE_STOP: "live:stop",
  LIVE_SET_MODE: "live:set-mode",
  LIVE_ACCOUNT_SNAPSHOT: "live:account-snapshot",
  LIVE_MULTI_SNAPSHOT: "live:multi-snapshot",
  APPROVAL_RESOLVE: "approval:resolve",
  APPROVAL_CANCEL_AUTO: "approval:cancel-auto",
  APPROVAL_CANCEL_NEAREST_AUTO: "approval:cancel-nearest-auto",
  APPROVAL_STOP_AUTOMATION: "approval:stop-automation",
  GEMINI_HEALTH: "gemini:health",
  GEMINI_CONNECT: "gemini:connect",
  GEMINI_DISCONNECT: "gemini:disconnect",
  GEMINI_REAUTH: "gemini:reauth",
  GEMINI_SET_PROVIDER: "gemini:set-provider",
  GEMINI_ACK_DEMO: "gemini:ack-demo",
  GEMINI_SET_MODEL: "gemini:set-model",
  GEMINI_LIST_MODELS: "gemini:list-models",
  GEMINI_PROBE: "gemini:probe",
  GEMINI_TEST: "gemini:test",
  GEMINI_SAVE_SESSION: "gemini:save-session",
  GEMINI_CLEAR_SESSION: "gemini:clear-session",
  TIKTOK_CONNECT: "tiktok:connect",
  TIKTOK_DISCONNECT: "tiktok:disconnect",
  LIVE_MANAGER_OPEN: "live-manager:open",
  LIVE_MANAGER_CLOSE: "live-manager:close",
  LIVE_MANAGER_REFRESH: "live-manager:refresh",
  LIVE_MANAGER_DIAGNOSTIC: "live-manager:diagnostic",
  COMMENT_PIN: "comment:pin",
  COMMENT_MARK_REPLIED: "comment:mark-replied",
  COMMENT_SKIP: "comment:skip",
  PRODUCT_SAVE: "product:save",
  PRODUCT_DELETE: "product:delete",
  PRODUCT_SELECT: "product:select",
  PRODUCT_SET_CURRENT: "product:set-current",
  ACCOUNT_FOCUS: "account:focus",
  ACCOUNT_CREATE: "account:create",
  ACCOUNT_UPDATE: "account:update",
  ACCOUNT_DELETE: "account:delete",
  KHEPREE_LOGIN: "khepree:login",
  KHEPREE_LOGOUT: "khepree:logout",
  KHEPREE_OPEN_PRODUCT: "khepree:open-product",
  KHEPREE_OPEN_BILLING: "khepree:open-billing",
  KHEPREE_REFRESH_OFFERS: "khepree:refresh-offers",
  KHEPREE_CHECKOUT: "khepree:checkout",
  SETTINGS_SET_LOCALE: "settings:set-locale",
  SETTINGS_SET_ONBOARDING: "settings:set-onboarding"
} as const;

/** Public multi-live overview — no runtimes, cookies, or BrowserContext. */
export interface MultiLiveSnapshot {
  lives: AccountLiveSnapshot[];
  focusedAccountId?: string;
  activeCount: number;
}

export interface AppSnapshot {
  appVersion: string;
  locale: AppLocale;
  onboarding: OnboardingState;
  /** @deprecated Prefer `lives` / getAccountSnapshot */
  liveRunning: boolean;
  /** @deprecated Prefer `lives` */
  automationMode: AutomationMode;
  /** @deprecated Prefer `lives` */
  liveState: string;
  /** @deprecated Prefer per-account approvals */
  approvals: ApprovalItem[];
  products: ProductDNA[];
  /** @deprecated Prefer getAccountSnapshot(accountId).currentProductId */
  currentProductId?: string;
  lives: AccountLiveSnapshot[];
  focusedAccountId?: string;
  health: RuntimeHealth[];
  khepree: KhepreePublicState;
  gemini: GeminiPublicState;
  /** @deprecated Prefer `lives[].tiktok` / registry getAllStates — focused shim only. */
  tiktok: TikTokPublicState;
  /** @deprecated Prefer `lives[].liveManager` — focused shim only. */
  liveManager: LiveManagerPublicState;
  comments: CommentFeedSnapshot;
  /** Present when startup closed stale live sessions left by a crash. */
  sessionRecovery?: SessionRecoveryNotice;
  /** Soft display of license max concurrent lives (not hardware). */
  maxConcurrentLives: number;
  /** Khepree license caps — separate from hardware ResourceGovernor. */
  licenseLimits: LivestreamLicenseLimits;
  /** Pending approvals from all accounts (capped) — Live Center queue. */
  pendingApprovals: ApprovalItem[];
}

/**
 * Typed preload bridge. Every protected live action requires accountId.
 * Main validates accountId — never trust the renderer alone.
 */
export interface RendererApi {
  snapshot(): Promise<AppSnapshot>;
  getAccountSnapshot(accountId: string): Promise<AccountLiveSnapshot>;
  getMultiLiveSnapshot(): Promise<MultiLiveSnapshot>;

  startLive(accountId: string): Promise<void>;
  stopLive(accountId: string): Promise<void>;
  setAutomationMode(accountId: string, mode: AutomationMode): Promise<void>;

  resolveApproval(
    accountId: string,
    approvalId: string,
    decision: "approve" | "reject",
    editedSpeech?: string
  ): Promise<void>;
  cancelApprovalAuto(accountId: string, approvalId: string): Promise<void>;
  cancelNearestApprovalAuto(accountId: string): Promise<void>;
  stopApprovalAutomation(accountId: string): Promise<void>;

  /** Connect using the account's stored username (validated in main). */
  connectTikTok(accountId: string): Promise<TikTokPublicState>;
  disconnectTikTok(accountId: string): Promise<TikTokPublicState>;

  openLiveManager(accountId: string): Promise<LiveManagerPublicState>;
  closeLiveManager(accountId: string): Promise<LiveManagerPublicState>;
  refreshLiveManager(accountId: string): Promise<LiveManagerPublicState>;
  captureLiveManagerDiagnostic(accountId: string): Promise<LiveManagerPublicState>;

  pinComment(accountId: string, eventId: string): Promise<void>;
  markCommentReplied(accountId: string, eventId: string): Promise<void>;
  skipComment(accountId: string, eventId: string): Promise<void>;

  /** Catalog save — does not bind current product unless setCurrentProduct is called. */
  saveProduct(product: ProductDNA): Promise<void>;
  deleteProduct(id: string): Promise<void>;
  setCurrentProduct(accountId: string, productId: string | null): Promise<void>;
  /** @deprecated Prefer setCurrentProduct */
  selectProduct(accountId: string, id: string | null): Promise<void>;

  setFocusedAccount(accountId: string | null): Promise<string | undefined>;
  createTikTokAccount(input: {
    username: string;
    displayName?: string;
    label?: string;
  }): Promise<TikTokAccount>;
  updateTikTokAccount(
    accountId: string,
    patch: { username?: string; displayName?: string; label?: string; enabled?: boolean }
  ): Promise<TikTokAccount>;
  deleteTikTokAccount(accountId: string): Promise<void>;

  startKhepreeLogin(): Promise<void>;
  logoutKhepree(): Promise<void>;
  openKhepreeProductPage(): Promise<void>;
  openKhepreeBilling(): Promise<void>;
  refreshKhepreeOffers(): Promise<import("./khepree-contracts").DesktopPurchasablePlan[]>;
  startKhepreeCheckout(planPublicId: string, pricePublicId: string): Promise<void>;
  setLocale(locale: AppLocale): Promise<AppLocale>;
  setOnboarding(state: OnboardingState): Promise<OnboardingState>;
  getGeminiState(): Promise<GeminiPublicState>;
  connectGemini(): Promise<GeminiPublicState>;
  disconnectGemini(): Promise<GeminiPublicState>;
  reauthGemini(): Promise<GeminiPublicState>;
  setLlmProvider(id: LlmProviderId): Promise<GeminiPublicState>;
  acknowledgeLlmDemo(): Promise<GeminiPublicState>;
  setGeminiModel(model: string): Promise<GeminiPublicState>;
  listGeminiModels(): Promise<string[]>;
  probeGemini(): Promise<GeminiProbeResult>;
  testGemini(prompt?: string): Promise<GeminiTestResult>;
  saveGeminiSession(secure1PSID: string, secure1PSIDTS?: string): Promise<GeminiPublicState>;
  clearGeminiSession(): Promise<GeminiPublicState>;
}
