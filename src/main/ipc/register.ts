import { app, ipcMain } from "electron";
import { IPC, type AppSnapshot, type MultiLiveSnapshot } from "../../shared/ipc";
import type { LlmProviderId } from "../../shared/gemini-contracts";
import { normalizeAppLocale, type AppLocale } from "../../shared/locale";
import type { OnboardingState } from "../../shared/onboarding";
import type { AccountLiveSnapshot, AutomationMode, ProductDNA } from "../../shared/live-types";
import { DEFAULT_ACCOUNT_AUTOMATION_MODE } from "../../shared/tiktok-account";
import { normalizeProduct, validateProduct } from "../../shared/product-dna";
import { AppContainer } from "../app-container";
import { requireValidAccountId } from "./account-id";

function legacyFocusedPane(container: AppContainer) {
  const focusedId = container.multiLive.focusedId;
  const snap = focusedId
    ? container.multiLive.getSnapshot(focusedId)
    : undefined;
  const runtime = focusedId ? container.multiLive.getRuntime(focusedId) : undefined;
  return {
    liveRunning: snap?.isRunning ?? false,
    automationMode: snap?.automationMode ?? DEFAULT_ACCOUNT_AUTOMATION_MODE,
    liveState: snap?.state ?? "IDLE",
    approvals: runtime?.listApprovals() ?? [],
    currentProductId: snap?.currentProductId
  };
}

function accountId(container: AppContainer, raw: unknown): string {
  return requireValidAccountId(raw, container.tiktokAccounts);
}

/** Bind connector routing focus after validating accountId. */
function focusAccount(container: AppContainer, id: string): void {
  container.multiLive.setFocusedAccountId(id);
  container.settings.setFocusedAccountId(id);
}

function enrichLiveSnapshot(
  container: AppContainer,
  snap: AccountLiveSnapshot
): AccountLiveSnapshot {
  const tiktok = container.tiktok.getState(snap.accountId);
  const liveManager = container.liveManager.getState(snap.accountId);
  return {
    ...snap,
    ...(tiktok ? { tiktok } : {}),
    ...(liveManager ? { liveManager } : {})
  };
}

export function registerIpc(container: AppContainer): void {
  ipcMain.handle(IPC.APP_SNAPSHOT, async (): Promise<AppSnapshot> => {
    const pane = legacyFocusedPane(container);
    const focusedId = container.multiLive.focusedId;
    return {
      appVersion: app.getVersion(),
      locale: container.settings.getLocale(),
      onboarding: container.settings.getOnboarding(),
      ...pane,
      lives: container.multiLive.getAllSnapshots().map((s) => enrichLiveSnapshot(container, s)),
      focusedAccountId: focusedId,
      products: container.products.list(),
      health: [
        await container.llm.health(),
        await container.tiktok.health(focusedId),
        await container.liveManager.health(focusedId),
        await container.media.health()
      ],
      khepree: container.khepree.publicState,
      gemini: await container.llm.getPublicState(),
      tiktok: container.tiktok.getPublicState(focusedId),
      liveManager: container.liveManager.getPublicState(focusedId),
      comments: container.comments.getSnapshot(),
      maxConcurrentLives: container.capacity.getLicenseLimits().maxConcurrentLives,
      licenseLimits: container.capacity.getLicenseLimits(),
      pendingApprovals: container.multiLive.listAllPendingApprovals().slice(0, 40),
      sessionRecovery: (() => {
        const report = container.getSessionRecoveryReport();
        if (report.recoveredCount <= 0) return undefined;
        return {
          recoveredCount: report.recoveredCount,
          recoveredAt: report.recoveredAt
        };
      })()
    };
  });

  ipcMain.handle(
    IPC.LIVE_ACCOUNT_SNAPSHOT,
    async (_event, rawAccountId: unknown): Promise<AccountLiveSnapshot> => {
      const id = accountId(container, rawAccountId);
      return enrichLiveSnapshot(container, container.multiLive.getSnapshot(id));
    }
  );

  ipcMain.handle(IPC.LIVE_MULTI_SNAPSHOT, async (): Promise<MultiLiveSnapshot> => {
    const lives = container.multiLive
      .getAllSnapshots()
      .map((s) => enrichLiveSnapshot(container, s));
    return {
      lives,
      focusedAccountId: container.multiLive.focusedId,
      activeCount: lives.filter((l) => l.isRunning).length
    };
  });

  ipcMain.handle(IPC.SETTINGS_SET_LOCALE, async (_event, locale: AppLocale) => {
    const next = normalizeAppLocale(locale);
    container.settings.setLocale(next);
    return next;
  });

  ipcMain.handle(IPC.SETTINGS_SET_ONBOARDING, async (_event, state: OnboardingState) => {
    return container.settings.setOnboarding(state);
  });

  ipcMain.handle(IPC.LIVE_START, async (_event, rawAccountId: unknown) => {
    const id = accountId(container, rawAccountId);
    focusAccount(container, id);
    container.multiLive.startLive(id);
  });

  ipcMain.handle(IPC.LIVE_STOP, async (_event, rawAccountId: unknown) => {
    const id = accountId(container, rawAccountId);
    container.multiLive.stopLive(id);
  });

  ipcMain.handle(
    IPC.LIVE_SET_MODE,
    async (_event, rawAccountId: unknown, mode: AutomationMode) => {
      container.khepree.assertProductAccess();
      if (mode === "FULL_AUTO") container.khepree.assertProductAccess("full_auto");
      const id = accountId(container, rawAccountId);
      container.multiLive.setAutomationMode(id, mode);
    }
  );

  ipcMain.handle(
    IPC.APPROVAL_RESOLVE,
    async (
      _event,
      rawAccountId: unknown,
      approvalId: unknown,
      decision: "approve" | "reject",
      editedSpeech?: string
    ) => {
      const id = accountId(container, rawAccountId);
      const aid = String(approvalId ?? "").trim();
      if (!aid) throw new Error("APPROVAL_ID_REQUIRED");
      await container.multiLive.resolveApproval(id, aid, decision, editedSpeech);
    }
  );

  ipcMain.handle(
    IPC.APPROVAL_CANCEL_AUTO,
    async (_event, rawAccountId: unknown, approvalId: unknown) => {
      const id = accountId(container, rawAccountId);
      const aid = String(approvalId ?? "").trim();
      if (!aid) throw new Error("APPROVAL_ID_REQUIRED");
      container.multiLive.cancelAutoApproval(id, aid);
    }
  );

  ipcMain.handle(
    IPC.APPROVAL_CANCEL_NEAREST_AUTO,
    async (_event, rawAccountId: unknown) => {
      const id = accountId(container, rawAccountId);
      container.multiLive.cancelNearestAutoApproval(id);
    }
  );

  ipcMain.handle(IPC.APPROVAL_STOP_AUTOMATION, async (_event, rawAccountId: unknown) => {
    const id = accountId(container, rawAccountId);
    container.multiLive.stopAutomation(id);
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
  });

  ipcMain.handle(IPC.PRODUCT_DELETE, async (_event, productId: unknown) => {
    container.khepree.assertProductAccess();
    const id = String(productId ?? "").trim();
    if (!id) throw new Error("PRODUCT_ID_REQUIRED");
    const deleted = container.products.delete(id);
    if (!deleted) throw new Error("PRODUCT_NOT_FOUND");
    // Clear current product on any account that pointed at it
    for (const snap of container.multiLive.getAllSnapshots()) {
      if (snap.currentProductId === id) {
        container.multiLive.setCurrentProduct(snap.accountId, undefined);
      }
    }
  });

  ipcMain.handle(
    IPC.PRODUCT_SET_CURRENT,
    async (_event, rawAccountId: unknown, productId: unknown) => {
      container.khepree.assertProductAccess();
      const id = accountId(container, rawAccountId);
      const pid =
        productId === null || productId === undefined || productId === ""
          ? undefined
          : String(productId);
      container.multiLive.setCurrentProduct(id, pid);
    }
  );

  ipcMain.handle(
    IPC.PRODUCT_SELECT,
    async (_event, rawAccountId: unknown, productId: unknown) => {
      container.khepree.assertProductAccess();
      const id = accountId(container, rawAccountId);
      const pid =
        productId === null || productId === undefined || productId === ""
          ? undefined
          : String(productId);
      container.multiLive.setCurrentProduct(id, pid);
    }
  );

  ipcMain.handle(IPC.ACCOUNT_FOCUS, async (_event, rawAccountId: unknown) => {
    if (rawAccountId === null || rawAccountId === undefined || rawAccountId === "") {
      container.multiLive.setFocusedAccountId(undefined);
      container.settings.setFocusedAccountId(undefined);
      return undefined;
    }
    const id = accountId(container, rawAccountId);
    focusAccount(container, id);
    return id;
  });

  ipcMain.handle(
    IPC.ACCOUNT_CREATE,
    async (
      _event,
      input: { username?: string; displayName?: string; label?: string }
    ) => {
      container.khepree.assertProductAccess();
      container.capacity.assertCanCreateAccount(container.tiktokAccounts.list().length);
      const username = String(input?.username ?? "").trim();
      if (!username) throw new Error("TIKTOK_USERNAME_REQUIRED");
      const created = container.tiktokAccounts.create({
        username,
        displayName: input.displayName,
        label: input.label
      });
      container.accountLiveSettings.ensure(created.id);
      if (!container.multiLive.focusedId) {
        focusAccount(container, created.id);
      }
      return created;
    }
  );

  ipcMain.handle(
    IPC.ACCOUNT_UPDATE,
    async (
      _event,
      rawAccountId: unknown,
      patch: {
        username?: string;
        displayName?: string;
        label?: string;
        enabled?: boolean;
      }
    ) => {
      container.khepree.assertProductAccess();
      const id = accountId(container, rawAccountId);
      return container.tiktokAccounts.update(id, {
        username: patch?.username,
        displayName: patch?.displayName,
        label: patch?.label,
        enabled: patch?.enabled
      });
    }
  );

  ipcMain.handle(IPC.ACCOUNT_DELETE, async (_event, rawAccountId: unknown) => {
    container.khepree.assertProductAccess();
    const id = accountId(container, rawAccountId);
    await container.tiktok.disposeAccount(id);
    await container.liveManager.dispose(id);
    container.tiktokAccounts.delete(id);
    container.multiLive.disposeAccount(id);
    if (container.settings.getFocusedAccountId() === id) {
      const next = container.tiktokAccounts.list()[0]?.id;
      container.multiLive.setFocusedAccountId(next);
      container.settings.setFocusedAccountId(next);
    }
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

  ipcMain.handle(IPC.TIKTOK_CONNECT, async (_event, rawAccountId: unknown) => {
    const id = accountId(container, rawAccountId);
    focusAccount(container, id);
    return container.tiktok.connect(id);
  });

  ipcMain.handle(IPC.TIKTOK_DISCONNECT, async (_event, rawAccountId: unknown) => {
    const id = accountId(container, rawAccountId);
    return container.tiktok.disconnect(id);
  });

  ipcMain.handle(IPC.LIVE_MANAGER_OPEN, async (_event, rawAccountId: unknown) => {
    container.khepree.assertProductAccess();
    const id = accountId(container, rawAccountId);
    focusAccount(container, id);
    return container.liveManager.open(id);
  });

  ipcMain.handle(IPC.LIVE_MANAGER_CLOSE, async (_event, rawAccountId: unknown) => {
    const id = accountId(container, rawAccountId);
    return container.liveManager.close(id);
  });

  ipcMain.handle(IPC.LIVE_MANAGER_REFRESH, async (_event, rawAccountId: unknown) => {
    const id = accountId(container, rawAccountId);
    return container.liveManager.refresh(id);
  });

  ipcMain.handle(IPC.LIVE_MANAGER_DIAGNOSTIC, async (_event, rawAccountId: unknown) => {
    const id = accountId(container, rawAccountId);
    return container.liveManager.captureDiagnostic(id);
  });

  ipcMain.handle(IPC.COMMENT_PIN, async (_event, rawAccountId: unknown, eventId: unknown) => {
    const id = accountId(container, rawAccountId);
    const eid = String(eventId ?? "").trim();
    if (!eid) throw new Error("COMMENT_ID_REQUIRED");
    container.comments.setOperatorPriority(id, eid, true);
  });

  ipcMain.handle(
    IPC.COMMENT_MARK_REPLIED,
    async (_event, rawAccountId: unknown, eventId: unknown) => {
      const id = accountId(container, rawAccountId);
      const eid = String(eventId ?? "").trim();
      if (!eid) throw new Error("COMMENT_ID_REQUIRED");
      container.comments.markReplied(id, eid);
    }
  );

  ipcMain.handle(IPC.COMMENT_SKIP, async (_event, rawAccountId: unknown, eventId: unknown) => {
    const id = accountId(container, rawAccountId);
    const eid = String(eventId ?? "").trim();
    if (!eid) throw new Error("COMMENT_ID_REQUIRED");
    container.comments.markSkipped(id, eid);
  });
}
