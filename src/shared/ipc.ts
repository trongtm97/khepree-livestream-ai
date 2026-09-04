import type { ApprovalItem, AutomationMode, ProductDNA, RuntimeHealth } from "./live-types";
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
import type { MediaPublicState } from "./media-contracts";
import type { LiveSessionSummary, SessionTotals } from "./session-history";

export const IPC = {
  APP_SNAPSHOT: "app:snapshot",
  LIVE_START: "live:start",
  LIVE_STOP: "live:stop",
  LIVE_SET_MODE: "live:set-mode",
  APPROVAL_RESOLVE: "approval:resolve",
  APPROVAL_CANCEL_AUTO: "approval:cancel-auto",
  APPROVAL_CANCEL_NEAREST_AUTO: "approval:cancel-nearest-auto",
  APPROVAL_STOP_AUTOMATION: "approval:stop-automation",
  LIVE_EMERGENCY_STOP: "live:emergency-stop",
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
  MEDIA_SET_VOICE: "media:set-voice",
  MEDIA_SET_VOICE_ENABLED: "media:set-voice-enabled",
  MEDIA_TEST_SPEECH: "media:test-speech",
  MEDIA_REFRESH: "media:refresh",
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
  KHEPREE_LOGIN: "khepree:login",
  KHEPREE_LOGOUT: "khepree:logout",
  KHEPREE_OPEN_PRODUCT: "khepree:open-product",
  KHEPREE_OPEN_BILLING: "khepree:open-billing",
  KHEPREE_REFRESH_OFFERS: "khepree:refresh-offers",
  KHEPREE_CHECKOUT: "khepree:checkout",
  SESSION_LIST: "session:list",
  SESSION_APPROVALS: "session:approvals",
  SESSION_TOTALS: "session:totals",
  SETTINGS_SET_LOCALE: "settings:set-locale",
  SETTINGS_SET_ONBOARDING: "settings:set-onboarding"
} as const;

export interface AppSnapshot {
  appVersion: string;
  locale: AppLocale;
  onboarding: OnboardingState;
  liveRunning: boolean;
  automationMode: AutomationMode;
  liveState: string;
  approvals: ApprovalItem[];
  products: ProductDNA[];
  currentProductId?: string;
  health: RuntimeHealth[];
  khepree: KhepreePublicState;
  gemini: GeminiPublicState;
  tiktok: TikTokPublicState;
  liveManager: LiveManagerPublicState;
  comments: CommentFeedSnapshot;
  media: MediaPublicState;
}

export interface RendererApi {
  snapshot(): Promise<AppSnapshot>;
  startLive(): Promise<void>;
  stopLive(): Promise<void>;
  setAutomationMode(mode: AutomationMode): Promise<void>;
  resolveApproval(id: string, decision: "approve" | "reject", editedSpeech?: string): Promise<void>;
  cancelApprovalAuto(id: string): Promise<void>;
  cancelNearestApprovalAuto(): Promise<void>;
  stopApprovalAutomation(): Promise<void>;
  emergencyStop(): Promise<number>;
  connectTikTok(uniqueId: string): Promise<TikTokPublicState>;
  disconnectTikTok(): Promise<TikTokPublicState>;
  openLiveManager(): Promise<LiveManagerPublicState>;
  closeLiveManager(): Promise<LiveManagerPublicState>;
  refreshLiveManager(): Promise<LiveManagerPublicState>;
  captureLiveManagerDiagnostic(): Promise<LiveManagerPublicState>;
  pinComment(eventId: string): Promise<void>;
  markCommentReplied(eventId: string): Promise<void>;
  skipComment(eventId: string): Promise<void>;
  saveProduct(product: ProductDNA): Promise<void>;
  deleteProduct(id: string): Promise<void>;
  selectProduct(id: string | null): Promise<void>;
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
  setMediaVoice(voice: string | undefined): Promise<MediaPublicState>;
  setMediaVoiceEnabled(enabled: boolean): Promise<MediaPublicState>;
  testMediaSpeech(text?: string): Promise<void>;
  refreshMedia(): Promise<MediaPublicState>;
  listSessions(limit?: number): Promise<LiveSessionSummary[]>;
  listSessionApprovals(sessionId: string, limit?: number): Promise<ApprovalItem[]>;
  getSessionTotals(): Promise<SessionTotals>;
}
