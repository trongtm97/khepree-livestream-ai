import { contextBridge, ipcRenderer } from "electron";
import { IPC, type RendererApi } from "../shared/ipc";
import type { LlmProviderId } from "../shared/gemini-contracts";
import type { AppLocale } from "../shared/locale";
import type { OnboardingState } from "../shared/onboarding";
import type { AutomationMode, ProductDNA } from "../shared/live-types";

const api: RendererApi = {
  snapshot: () => ipcRenderer.invoke(IPC.APP_SNAPSHOT),
  getAccountSnapshot: (accountId: string) =>
    ipcRenderer.invoke(IPC.LIVE_ACCOUNT_SNAPSHOT, accountId),
  getMultiLiveSnapshot: () => ipcRenderer.invoke(IPC.LIVE_MULTI_SNAPSHOT),

  startLive: (accountId: string) => ipcRenderer.invoke(IPC.LIVE_START, accountId),
  stopLive: (accountId: string) => ipcRenderer.invoke(IPC.LIVE_STOP, accountId),
  setAutomationMode: (accountId: string, mode: AutomationMode) =>
    ipcRenderer.invoke(IPC.LIVE_SET_MODE, accountId, mode),

  resolveApproval: (accountId, approvalId, decision, editedSpeech) =>
    ipcRenderer.invoke(IPC.APPROVAL_RESOLVE, accountId, approvalId, decision, editedSpeech),
  cancelApprovalAuto: (accountId: string, approvalId: string) =>
    ipcRenderer.invoke(IPC.APPROVAL_CANCEL_AUTO, accountId, approvalId),
  cancelNearestApprovalAuto: (accountId: string) =>
    ipcRenderer.invoke(IPC.APPROVAL_CANCEL_NEAREST_AUTO, accountId),
  stopApprovalAutomation: (accountId: string) =>
    ipcRenderer.invoke(IPC.APPROVAL_STOP_AUTOMATION, accountId),

  connectTikTok: (accountId: string) =>
    ipcRenderer.invoke(IPC.TIKTOK_CONNECT, accountId),
  disconnectTikTok: (accountId: string) =>
    ipcRenderer.invoke(IPC.TIKTOK_DISCONNECT, accountId),

  openLiveManager: (accountId: string) =>
    ipcRenderer.invoke(IPC.LIVE_MANAGER_OPEN, accountId),
  closeLiveManager: (accountId: string) =>
    ipcRenderer.invoke(IPC.LIVE_MANAGER_CLOSE, accountId),
  refreshLiveManager: (accountId: string) =>
    ipcRenderer.invoke(IPC.LIVE_MANAGER_REFRESH, accountId),
  captureLiveManagerDiagnostic: (accountId: string) =>
    ipcRenderer.invoke(IPC.LIVE_MANAGER_DIAGNOSTIC, accountId),

  pinComment: (eventId: string) => ipcRenderer.invoke(IPC.COMMENT_PIN, eventId),
  markCommentReplied: (eventId: string) =>
    ipcRenderer.invoke(IPC.COMMENT_MARK_REPLIED, eventId),
  skipComment: (eventId: string) => ipcRenderer.invoke(IPC.COMMENT_SKIP, eventId),

  saveProduct: (product: ProductDNA) => ipcRenderer.invoke(IPC.PRODUCT_SAVE, product),
  deleteProduct: (id: string) => ipcRenderer.invoke(IPC.PRODUCT_DELETE, id),
  setCurrentProduct: (accountId: string, productId: string | null) =>
    ipcRenderer.invoke(IPC.PRODUCT_SET_CURRENT, accountId, productId),
  selectProduct: (accountId: string, id: string | null) =>
    ipcRenderer.invoke(IPC.PRODUCT_SELECT, accountId, id),

  setFocusedAccount: (accountId: string | null) =>
    ipcRenderer.invoke(IPC.ACCOUNT_FOCUS, accountId),
  createTikTokAccount: (input) => ipcRenderer.invoke(IPC.ACCOUNT_CREATE, input),
  updateTikTokAccount: (accountId, patch) =>
    ipcRenderer.invoke(IPC.ACCOUNT_UPDATE, accountId, patch),
  deleteTikTokAccount: (accountId: string) =>
    ipcRenderer.invoke(IPC.ACCOUNT_DELETE, accountId),

  startKhepreeLogin: () => ipcRenderer.invoke(IPC.KHEPREE_LOGIN),
  logoutKhepree: () => ipcRenderer.invoke(IPC.KHEPREE_LOGOUT),
  openKhepreeProductPage: () => ipcRenderer.invoke(IPC.KHEPREE_OPEN_PRODUCT),
  openKhepreeBilling: () => ipcRenderer.invoke(IPC.KHEPREE_OPEN_BILLING),
  refreshKhepreeOffers: () => ipcRenderer.invoke(IPC.KHEPREE_REFRESH_OFFERS),
  startKhepreeCheckout: (planPublicId, pricePublicId) =>
    ipcRenderer.invoke(IPC.KHEPREE_CHECKOUT, planPublicId, pricePublicId),
  setLocale: (locale: AppLocale) => ipcRenderer.invoke(IPC.SETTINGS_SET_LOCALE, locale),
  setOnboarding: (state: OnboardingState) =>
    ipcRenderer.invoke(IPC.SETTINGS_SET_ONBOARDING, state),
  getGeminiState: () => ipcRenderer.invoke(IPC.GEMINI_HEALTH),
  connectGemini: () => ipcRenderer.invoke(IPC.GEMINI_CONNECT),
  disconnectGemini: () => ipcRenderer.invoke(IPC.GEMINI_DISCONNECT),
  reauthGemini: () => ipcRenderer.invoke(IPC.GEMINI_REAUTH),
  setLlmProvider: (id: LlmProviderId) => ipcRenderer.invoke(IPC.GEMINI_SET_PROVIDER, id),
  acknowledgeLlmDemo: () => ipcRenderer.invoke(IPC.GEMINI_ACK_DEMO),
  setGeminiModel: (model: string) => ipcRenderer.invoke(IPC.GEMINI_SET_MODEL, model),
  listGeminiModels: () => ipcRenderer.invoke(IPC.GEMINI_LIST_MODELS),
  probeGemini: () => ipcRenderer.invoke(IPC.GEMINI_PROBE),
  testGemini: (prompt?: string) => ipcRenderer.invoke(IPC.GEMINI_TEST, prompt),
  saveGeminiSession: (secure1PSID: string, secure1PSIDTS?: string) =>
    ipcRenderer.invoke(IPC.GEMINI_SAVE_SESSION, secure1PSID, secure1PSIDTS),
  clearGeminiSession: () => ipcRenderer.invoke(IPC.GEMINI_CLEAR_SESSION)
};

contextBridge.exposeInMainWorld("khepreeLivestreamAI", api);
