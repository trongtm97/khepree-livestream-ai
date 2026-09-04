import { app, ipcMain } from "electron";
import { IPC, type AppSnapshot } from "../../shared/ipc";
import type { LlmProviderId } from "../../shared/gemini-contracts";
import { normalizeAppLocale, type AppLocale } from "../../shared/locale";
import type { OnboardingState } from "../../shared/onboarding";
import type { AutomationMode, ProductDNA } from "../../shared/live-types";
import { normalizeProduct, validateProduct } from "../../shared/product-dna";
import { AppContainer } from "../app-container";

export function registerIpc(container: AppContainer): void {
  ipcMain.handle(IPC.APP_SNAPSHOT, async (): Promise<AppSnapshot> => ({
    appVersion: app.getVersion(),
    locale: container.settings.getLocale(),
    onboarding: container.settings.getOnboarding(),
    liveRunning: container.live.isRunning,
    automationMode: container.live.automationMode,
    liveState: container.live.state,
    approvals: container.live.listApprovals(),
    products: container.products.list(),
    currentProductId: container.currentProductId,
    health: [
      await container.llm.health(),
      await container.tiktok.health(),
      await container.liveManager.health(),
      await container.media.health()
    ],
    khepree: container.khepree.publicState,
    gemini: await container.llm.getPublicState(),
    tiktok: container.tiktok.getPublicState(),
    liveManager: container.liveManager.getPublicState(),
    comments: container.comments.getSnapshot()
  }));

  ipcMain.handle(IPC.SETTINGS_SET_LOCALE, async (_event, locale: AppLocale) => {
    const next = normalizeAppLocale(locale);
    container.settings.setLocale(next);
    return next;
  });

  ipcMain.handle(IPC.SETTINGS_SET_ONBOARDING, async (_event, state: OnboardingState) => {
    return container.settings.setOnboarding(state);
  });

  ipcMain.handle(IPC.LIVE_START, async () => {
    container.khepree.assertProductAccess();
    container.live.start();
  });

  ipcMain.handle(IPC.LIVE_STOP, async () => {
    container.live.stop();
  });

  ipcMain.handle(IPC.LIVE_SET_MODE, async (_event, mode: AutomationMode) => {
    container.khepree.assertProductAccess();
    if (mode === "FULL_AUTO") container.khepree.assertProductAccess("full_auto");
    container.live.setMode(mode);
  });

  ipcMain.handle(
    IPC.APPROVAL_RESOLVE,
    async (_event, id: string, decision: "approve" | "reject", editedSpeech?: string) => {
      await container.live.resolveApproval(id, decision, editedSpeech);
    }
  );

  ipcMain.handle(IPC.APPROVAL_CANCEL_AUTO, async (_event, id: string) => {
    container.live.cancelAutoApproval(String(id ?? ""));
  });

  ipcMain.handle(IPC.APPROVAL_CANCEL_NEAREST_AUTO, async () => {
    container.live.cancelNearestAutoApproval();
  });

  ipcMain.handle(IPC.APPROVAL_STOP_AUTOMATION, async () => {
    container.live.stopAutomation();
  });

  ipcMain.handle(IPC.PRODUCT_SAVE, async (_event, product: ProductDNA) => {
    container.khepree.assertProductAccess();
    const normalized = normalizeProduct(product);
    const validation = validateProduct(normalized);
    if (!validation.ok) {
      const code = validation.errors.title
        ?? validation.errors.priceText
        ?? validation.errors.sourceUrl
        ?? "PRODUCT_INVALID";
      throw new Error(code);
    }
    container.products.save(normalized);
    container.setCurrentProductId(normalized.id);
  });

  ipcMain.handle(IPC.PRODUCT_DELETE, async (_event, id: string) => {
    container.khepree.assertProductAccess();
    if (!id?.trim()) throw new Error("PRODUCT_ID_REQUIRED");
    const deleted = container.products.delete(id);
    if (!deleted) throw new Error("PRODUCT_NOT_FOUND");
    if (container.settings.getCurrentProductId() === id) {
      container.setCurrentProductId(container.products.list()[0]?.id);
    }
  });

  ipcMain.handle(IPC.PRODUCT_SELECT, async (_event, id: string | null) => {
    container.khepree.assertProductAccess();
    if (!id) {
      container.setCurrentProductId(undefined);
      return;
    }
    container.setCurrentProductId(id);
  });

  ipcMain.handle(IPC.GEMINI_HEALTH, async () => container.llm.getPublicState());
  ipcMain.handle(IPC.GEMINI_CONNECT, async () => {
    container.khepree.assertProductAccess();
    return container.llm.connect();
  });
  ipcMain.handle(IPC.GEMINI_DISCONNECT, async () => container.llm.disconnect());
  ipcMain.handle(IPC.GEMINI_REAUTH, async () => {
    container.khepree.assertProductAccess();
    return container.llm.reauth();
  });
  ipcMain.handle(IPC.GEMINI_SET_PROVIDER, async (_event, id: LlmProviderId) => {
    if (id !== "mock" && id !== "gemini-web") throw new Error("LLM_PROVIDER_INVALID");
    await container.llm.setPreferredProvider(id);
    return container.llm.getPublicState();
  });
  ipcMain.handle(IPC.GEMINI_ACK_DEMO, async () => {
    container.llm.acknowledgeDemoMode();
    return container.llm.getPublicState();
  });
  ipcMain.handle(IPC.GEMINI_SET_MODEL, async (_event, model: string) => {
    await container.llm.setModel(model);
    return container.llm.getPublicState();
  });
  ipcMain.handle(IPC.GEMINI_LIST_MODELS, async () => container.llm.listModels());
  ipcMain.handle(IPC.GEMINI_PROBE, async () => {
    container.khepree.assertProductAccess();
    return container.llm.probe();
  });
  ipcMain.handle(IPC.GEMINI_TEST, async (_event, prompt?: string) => {
    container.khepree.assertProductAccess();
    return container.llm.testConnection(typeof prompt === "string" ? prompt : undefined);
  });
  ipcMain.handle(
    IPC.GEMINI_SAVE_SESSION,
    async (_event, secure1PSID: string, secure1PSIDTS?: string) => {
      container.khepree.assertProductAccess();
      return container.llm.saveManualSession(secure1PSID, secure1PSIDTS);
    }
  );
  ipcMain.handle(IPC.GEMINI_CLEAR_SESSION, async () => {
    container.khepree.assertProductAccess();
    return container.llm.clearManualSession();
  });

  ipcMain.handle(IPC.KHEPREE_LOGIN, async () => {
    await container.khepree.startLogin();
  });

  ipcMain.handle(IPC.KHEPREE_LOGOUT, async () => {
    await container.khepree.logout();
  });

  ipcMain.handle(IPC.KHEPREE_OPEN_PRODUCT, async () => {
    await container.khepree.openProductPage();
  });

  ipcMain.handle(IPC.KHEPREE_OPEN_BILLING, async () => {
    await container.khepree.openAccountBilling();
  });

  ipcMain.handle(IPC.KHEPREE_REFRESH_OFFERS, async () => {
    return container.khepree.refreshOffers();
  });

  ipcMain.handle(
    IPC.KHEPREE_CHECKOUT,
    async (_event, planPublicId: string, pricePublicId: string) => {
      await container.khepree.startCheckout(planPublicId, pricePublicId);
    }
  );

  ipcMain.handle(IPC.TIKTOK_CONNECT, async (_event, uniqueId: string) => {
    return container.tiktok.connect(String(uniqueId ?? ""));
  });

  ipcMain.handle(IPC.TIKTOK_DISCONNECT, async () => {
    return container.tiktok.disconnect();
  });

  ipcMain.handle(IPC.LIVE_MANAGER_OPEN, async () => {
    container.khepree.assertProductAccess();
    return container.liveManager.open();
  });

  ipcMain.handle(IPC.LIVE_MANAGER_CLOSE, async () => {
    return container.liveManager.close();
  });

  ipcMain.handle(IPC.LIVE_MANAGER_REFRESH, async () => {
    return container.liveManager.refresh();
  });

  ipcMain.handle(IPC.LIVE_MANAGER_DIAGNOSTIC, async () => {
    return container.liveManager.captureDiagnostic();
  });

  ipcMain.handle(IPC.COMMENT_PIN, async (_event, eventId: string) => {
    const id = String(eventId ?? "").trim();
    if (!id) throw new Error("COMMENT_ID_REQUIRED");
    if (!container.comments.setOperatorPriority(id, true)) {
      throw new Error("COMMENT_NOT_FOUND");
    }
  });

  ipcMain.handle(IPC.COMMENT_MARK_REPLIED, async (_event, eventId: string) => {
    const id = String(eventId ?? "").trim();
    if (!id) throw new Error("COMMENT_ID_REQUIRED");
    if (!container.comments.markReplied(id)) throw new Error("COMMENT_NOT_FOUND");
  });

  ipcMain.handle(IPC.COMMENT_SKIP, async (_event, eventId: string) => {
    const id = String(eventId ?? "").trim();
    if (!id) throw new Error("COMMENT_ID_REQUIRED");
    if (!container.comments.markSkipped(id)) throw new Error("COMMENT_NOT_FOUND");
  });
}
