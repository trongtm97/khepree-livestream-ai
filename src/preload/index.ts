import { contextBridge, ipcRenderer } from "electron";
import { IPC, type RendererApi } from "../shared/ipc";
import type { LlmProviderId } from "../shared/gemini-contracts";
import type { AppLocale } from "../shared/locale";
import type { OnboardingState } from "../shared/onboarding";
import type { AutomationMode, ProductDNA } from "../shared/live-types";

const api: RendererApi = {
  snapshot: () => ipcRenderer.invoke(IPC.APP_SNAPSHOT),
  startLive: () => ipcRenderer.invoke(IPC.LIVE_START),
  stopLive: () => ipcRenderer.invoke(IPC.LIVE_STOP),
  setAutomationMode: (mode: AutomationMode) =>
    ipcRenderer.invoke(IPC.LIVE_SET_MODE, mode),
  resolveApproval: (id, decision, editedSpeech) =>
    ipcRenderer.invoke(IPC.APPROVAL_RESOLVE, id, decision, editedSpeech),
  cancelApprovalAuto: (id: string) => ipcRenderer.invoke(IPC.APPROVAL_CANCEL_AUTO, id),
  cancelNearestApprovalAuto: () => ipcRenderer.invoke(IPC.APPROVAL_CANCEL_NEAREST_AUTO),
  stopApprovalAutomation: () => ipcRenderer.invoke(IPC.APPROVAL_STOP_AUTOMATION),
  emergencyStop: () => ipcRenderer.invoke(IPC.LIVE_EMERGENCY_STOP),
  connectTikTok: (uniqueId: string) =>
    ipcRenderer.invoke(IPC.TIKTOK_CONNECT, uniqueId),
  disconnectTikTok: () => ipcRenderer.invoke(IPC.TIKTOK_DISCONNECT),
  openLiveManager: () => ipcRenderer.invoke(IPC.LIVE_MANAGER_OPEN),
  closeLiveManager: () => ipcRenderer.invoke(IPC.LIVE_MANAGER_CLOSE),
  refreshLiveManager: () => ipcRenderer.invoke(IPC.LIVE_MANAGER_REFRESH),
  captureLiveManagerDiagnostic: () =>
    ipcRenderer.invoke(IPC.LIVE_MANAGER_DIAGNOSTIC),
  pinComment: (eventId: string) => ipcRenderer.invoke(IPC.COMMENT_PIN, eventId),
  markCommentReplied: (eventId: string) =>
    ipcRenderer.invoke(IPC.COMMENT_MARK_REPLIED, eventId),
  skipComment: (eventId: string) => ipcRenderer.invoke(IPC.COMMENT_SKIP, eventId),
  saveProduct: (product: ProductDNA) =>
    ipcRenderer.invoke(IPC.PRODUCT_SAVE, product),
  deleteProduct: (id: string) => ipcRenderer.invoke(IPC.PRODUCT_DELETE, id),
  selectProduct: (id: string | null) => ipcRenderer.invoke(IPC.PRODUCT_SELECT, id),
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
  clearGeminiSession: () => ipcRenderer.invoke(IPC.GEMINI_CLEAR_SESSION),
  setMediaVoice: (voice: string | undefined) =>
    ipcRenderer.invoke(IPC.MEDIA_SET_VOICE, voice),
  setMediaVoiceEnabled: (enabled: boolean) =>
    ipcRenderer.invoke(IPC.MEDIA_SET_VOICE_ENABLED, enabled),
  testMediaSpeech: (text?: string) => ipcRenderer.invoke(IPC.MEDIA_TEST_SPEECH, text),
  refreshMedia: () => ipcRenderer.invoke(IPC.MEDIA_REFRESH),
  listSessions: (limit?: number) => ipcRenderer.invoke(IPC.SESSION_LIST, limit),
  listSessionApprovals: (sessionId: string, limit?: number) =>
    ipcRenderer.invoke(IPC.SESSION_APPROVALS, sessionId, limit),
  getSessionTotals: () => ipcRenderer.invoke(IPC.SESSION_TOTALS)
};

contextBridge.exposeInMainWorld("khepreeLivestreamAI", api);
