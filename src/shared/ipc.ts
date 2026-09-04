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
import type {
  LiveStartReadyBatchResult,
  LiveStopAllBatchResult
} from "./live-batch";
import type { AppEvent } from "./app-events";
import type { SystemResourcePublicSnapshot } from "./system-resources";
import type {
  AudioDeviceInfo,
  AudioOutputType,
  AvatarEngineSettings,
  AvatarHealth,
  MediaEnginePublicState,
  MediaProfile,
  TtsVoiceInfo
} from "./media-contracts";
import type {
  AvatarAsset,
  AvatarAssetEngine,
  AvatarPreprocessJob
} from "./avatar-assets";
import type {
  SceneEnginePublicState,
  SceneFrame,
  SceneLayoutId
} from "./scene-types";
import type { OperatorControlPublicSnapshot } from "./operator-control";
import type {
  MediaDryRunResult,
  MediaMultiDryRunResult,
  MediaReadinessReport
} from "./media-readiness";

export type {
  LiveStartReadyBatchResult,
  LiveStopAllBatchResult,
  LiveBatchAccountResult
} from "./live-batch";
export type {
  MediaDryRunResult,
  MediaMultiDryRunResult,
  MediaReadinessReport,
  MediaReadinessItem,
  MediaReadinessStatus,
  MediaReadinessItemId
} from "./media-readiness";
export type { AppEvent, AppEventType } from "./app-events";
export type {
  AudioDeviceInfo,
  AudioOutputType,
  AvatarEngineSettings,
  AvatarHealth,
  LiveTalkingTransport,
  MediaEnginePublicState,
  MediaProfile,
  TtsVoiceInfo,
  TtsProviderId
} from "./media-contracts";
export type {
  AvatarAsset,
  AvatarAssetEngine,
  AvatarAssetStatus,
  AvatarPreprocessJob
} from "./avatar-assets";
export type {
  SceneFrame,
  SceneEnginePublicState,
  SceneLayoutId,
  SceneResolution
} from "./scene-types";
export type {
  OperatorControlPublicSnapshot,
  OperatorControlMode,
  OperatorControlAccountState
} from "./operator-control";

/** Operator-facing crash recovery notice after abnormal app exit. */
export interface SessionRecoveryNotice {
  recoveredCount: number;
  recoveredAt: string;
}

export const IPC = {
  APP_SNAPSHOT: "app:snapshot",
  LIVE_START: "live:start",
  LIVE_STOP: "live:stop",
  LIVE_START_READY_BATCH: "live:start-ready-batch",
  LIVE_STOP_ALL: "live:stop-all",
  LIVE_SET_MODE: "live:set-mode",
  LIVE_SET_OUTPUT_MODE: "live:set-output-mode",
  LIVE_ACCOUNT_SNAPSHOT: "live:account-snapshot",
  LIVE_MULTI_SNAPSHOT: "live:multi-snapshot",
  COMMENTS_SNAPSHOT: "comments:snapshot",
  HEALTH_SNAPSHOT: "health:snapshot",
  APP_EVENT: "app:event",
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
  SETTINGS_SET_ONBOARDING: "settings:set-onboarding",
  MEDIA_LIST_VOICES: "media:list-voices",
  MEDIA_LIST_AUDIO_DEVICES: "media:list-audio-devices",
  MEDIA_GET_PROFILE: "media:get-profile",
  MEDIA_SET_PROFILE: "media:set-profile",
  MEDIA_PREVIEW: "media:preview",
  MEDIA_ENGINE_STATUS: "media:engine-status",
  MEDIA_PROBE_AVATAR_ENGINE: "media:probe-avatar-engine",
  AVATAR_LIST: "avatar:list",
  AVATAR_GET: "avatar:get",
  AVATAR_CREATE: "avatar:create",
  AVATAR_RENAME: "avatar:rename",
  AVATAR_DUPLICATE: "avatar:duplicate",
  AVATAR_DELETE: "avatar:delete",
  AVATAR_PREPROCESS: "avatar:preprocess",
  AVATAR_PREPROCESS_JOB: "avatar:preprocess-job",
  AVATAR_PICK_VIDEO: "avatar:pick-video",
  AVATAR_SELECT_FOR_ACCOUNT: "avatar:select-for-account",
  AVATAR_TEST_SPEAK: "avatar:test-speak",
  SCENE_LIST: "scene:list",
  SCENE_GET_STATE: "scene:get-state",
  SCENE_SET_MANUAL: "scene:set-manual",
  SCENE_CLEAR_OVERRIDE: "scene:clear-override",
  SCENE_SET_RESOLUTION: "scene:set-resolution",
  SCENE_PREVIEW_FRAME: "scene:preview-frame",
  MEDIA_READINESS_GET: "media:readiness-get",
  MEDIA_DRY_RUN: "media:dry-run",
  MEDIA_MULTI_DRY_RUN: "media:multi-dry-run",
  OPERATOR_TAKEOVER: "operator:takeover",
  OPERATOR_EXIT_TAKEOVER: "operator:exit-takeover",
  OPERATOR_TOGGLE_TAKEOVER: "operator:toggle-takeover",
  OPERATOR_EMERGENCY_STOP: "operator:emergency-stop",
  OPERATOR_GET_STATE: "operator:get-state",
  OPERATOR_SET_HOTKEY: "operator:set-hotkey"
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
  /** Cached OS metrics — CPU/GPU may be UNKNOWN; never invents numbers. */
  resources?: SystemResourcePublicSnapshot;
  /** Human takeover / emergency state. */
  operatorControl?: OperatorControlPublicSnapshot;
}

/**
 * Typed preload bridge. Every protected live action requires accountId.
 * Main validates accountId — never trust the renderer alone.
 */
export interface RendererApi {
  snapshot(): Promise<AppSnapshot>;
  getAccountSnapshot(accountId: string): Promise<AccountLiveSnapshot>;
  getMultiLiveSnapshot(): Promise<MultiLiveSnapshot>;
  getCommentsSnapshot(accountId?: string): Promise<CommentFeedSnapshot>;
  getHealthSnapshot(): Promise<RuntimeHealth[]>;
  /** Typed realtime channel — returns unsubscribe. Never exposes raw ipcRenderer. */
  onAppEvent(callback: (event: AppEvent) => void): () => void;

  startLive(accountId: string): Promise<void>;
  stopLive(accountId: string): Promise<void>;
  /** Main-process batch: start every ready account; one failure does not abort others. */
  startReadyLives(): Promise<LiveStartReadyBatchResult>;
  /** Main-process batch: stop all AI lives (not TikTok / browser). */
  stopAllLives(): Promise<LiveStopAllBatchResult>;
  setAutomationMode(accountId: string, mode: AutomationMode): Promise<void>;
  setLiveOutputMode(
    accountId: string,
    mode: import("./live-output-mode").LiveOutputMode
  ): Promise<void>;

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

  listMediaVoices(): Promise<TtsVoiceInfo[]>;
  listAudioDevices(): Promise<AudioDeviceInfo[]>;
  getMediaProfile(accountId: string): Promise<MediaProfile>;
  setMediaProfile(
    accountId: string,
    patch: {
      voiceId?: string | null;
      rate?: number;
      audioOutputType?: AudioOutputType;
      audioOutputDeviceId?: string | null;
      allowDeviceCollision?: boolean;
      avatarEngine?: AvatarEngineSettings;
    }
  ): Promise<MediaProfile>;
  previewMediaVoice(accountId: string, text?: string): Promise<void>;
  getMediaEngineStatus(): Promise<MediaEnginePublicState>;
  probeAvatarEngine(accountId: string): Promise<{
    connected: boolean;
    configured: boolean;
    health: AvatarHealth;
    probe?: {
      serverReachable: boolean;
      avatarExists: boolean;
      sessionStarted: boolean;
      audioAccepted: boolean;
      outputAvailable: boolean;
      message: string;
    };
  }>;

  listAvatars(): Promise<AvatarAsset[]>;
  getAvatar(id: string): Promise<AvatarAsset | null>;
  createAvatar(input: {
    name: string;
    engine: AvatarAssetEngine;
    sourcePath: string;
    previewImagePath?: string;
  }): Promise<AvatarAsset>;
  renameAvatar(id: string, name: string): Promise<AvatarAsset>;
  duplicateAvatar(id: string): Promise<AvatarAsset>;
  deleteAvatar(id: string): Promise<void>;
  preprocessAvatar(id: string): Promise<AvatarPreprocessJob>;
  getAvatarPreprocessJob(jobId: string): Promise<AvatarPreprocessJob | null>;
  pickAvatarVideo(): Promise<string | null>;
  selectAvatarForAccount(accountId: string, avatarId: string | null): Promise<MediaProfile>;
  testAvatarSpeak(accountId: string, text?: string): Promise<void>;

  listScenes(): Promise<Array<{ id: SceneLayoutId; name: string }>>;
  getSceneState(accountId: string): Promise<SceneEnginePublicState>;
  setSceneManual(accountId: string, sceneId: string): Promise<SceneEnginePublicState>;
  clearSceneOverride(accountId: string): Promise<SceneEnginePublicState>;
  setSceneResolution(
    accountId: string,
    preset: "720x1280" | "1080x1920"
  ): Promise<SceneEnginePublicState>;
  getScenePreviewFrame(
    accountId: string,
    priority?: "focused" | "card" | "hidden"
  ): Promise<SceneFrame | null>;

  getMediaReadiness(accountId: string): Promise<MediaReadinessReport>;
  runMediaDryRun(accountId: string): Promise<MediaDryRunResult>;
  runMediaMultiDryRun(accountIds?: string[]): Promise<MediaMultiDryRunResult>;

  enterTakeover(accountId: string): Promise<OperatorControlPublicSnapshot>;
  exitTakeover(accountId: string): Promise<OperatorControlPublicSnapshot>;
  toggleTakeover(accountId: string): Promise<OperatorControlPublicSnapshot>;
  emergencyStopAllAi(): Promise<OperatorControlPublicSnapshot>;
  getOperatorControlState(): Promise<OperatorControlPublicSnapshot>;
  setTakeoverHotkey(hotkey: string): Promise<string>;
}
