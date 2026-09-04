import { app, dialog, ipcMain } from "electron";
import type { AvatarAssetEngine } from "../../shared/avatar-assets";
import { DEFAULT_SCENES } from "../../shared/scene-types";
import type { PreviewPriority } from "../live/scene/scene-engine";
import { IPC, type AppSnapshot, type MultiLiveSnapshot } from "../../shared/ipc";
import type {
  LiveStartReadyBatchResult,
  LiveStopAllBatchResult
} from "../../shared/live-batch";
import type { LlmProviderId } from "../../shared/gemini-contracts";
import { normalizeAppLocale, type AppLocale } from "../../shared/locale";
import type { OnboardingState } from "../../shared/onboarding";
import type { AccountLiveSnapshot, AutomationMode, ProductDNA } from "../../shared/live-types";
import { DEFAULT_ACCOUNT_AUTOMATION_MODE } from "../../shared/tiktok-account";
import { normalizeProduct, validateProduct } from "../../shared/product-dna";
import {
  findAudioDeviceCollision,
  isVoiceStreamAudioReady,
  isVoiceStreamMode
} from "../../shared/audio-routing";
import {
  checkOutputModeLicense,
  normalizeLiveOutputMode,
  resolveMediaCapabilities
} from "../../shared/live-output-mode";
import {
  isAvatarEngineConfigured,
  isLiveTalkingEngineConfigured,
  isMuseTalkEngineConfigured,
  type AvatarEngineSettings
} from "../../shared/media-contracts";
import { ExternalLiveTalkingProvider } from "../connectors/media/avatar/external-livetalking-provider";
import { MuseTalkLocalProvider } from "../connectors/media/avatar/musetalk-local-provider";
import { AppContainer } from "../app-container";
import { resolveAppRoot } from "../app-paths";
import {
  listAudioDevicesOnce,
  resolveAudioBridgeExe
} from "../connectors/media/audio/windows-audio-bridge";
import {
  getMediaReadinessReport,
  runMediaDryRun,
  runMediaMultiDryRun
} from "../live/media-readiness-service";
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
  const profile = container.mediaProfiles.getByAccount(snap.accountId);
  const settings = container.accountLiveSettings.ensure(snap.accountId);
  const outputType = profile?.audioOutputType ?? "local-preview";
  const deviceId = profile?.audioOutputDeviceId;
  const voiceStream = isVoiceStreamMode(profile);
  const mediaCapabilities = resolveMediaCapabilities({
    ttsStatus: "UNKNOWN",
    audioOutputType: outputType,
    audioOutputDeviceId: deviceId,
    avatarReady: isAvatarEngineConfigured(profile?.avatarEngine),
    videoRouteReady:
      isLiveTalkingEngineConfigured(profile?.avatarEngine) &&
      profile?.avatarEngine.transport === "virtualcam"
  });
  return {
    ...snap,
    outputMode: settings.outputMode,
    mediaCapabilities,
    audioRouting: {
      mode: voiceStream ? "voice-stream" : "assistant-only",
      outputType,
      deviceId,
      ready: isVoiceStreamAudioReady(profile)
    },
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
      resources: (() => {
        const snap = container.getResourceSnapshot();
        return {
          checkedAt: snap.checkedAt,
          cpuLoadPercent: snap.cpuLoadPercent,
          ramAvailableMb: snap.ramAvailableMb,
          ramUsedPercent: snap.ramUsedPercent,
          gpu: snap.gpu
        };
      })(),
      operatorControl: container.multiLive.getOperatorControlSnapshot(),
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

  ipcMain.handle(IPC.COMMENTS_SNAPSHOT, async (_event, rawAccountId: unknown) => {
    if (rawAccountId === undefined || rawAccountId === null || rawAccountId === "") {
      return container.comments.getSnapshot();
    }
    const id = accountId(container, rawAccountId);
    return container.comments.getSnapshotForAccount(id);
  });

  ipcMain.handle(IPC.HEALTH_SNAPSHOT, async () => {
    const focusedId = container.multiLive.focusedId;
    return [
      await container.llm.health(),
      await container.tiktok.health(focusedId),
      await container.liveManager.health(focusedId),
      await container.media.health()
    ];
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

  ipcMain.handle(IPC.LIVE_START_READY_BATCH, async (): Promise<LiveStartReadyBatchResult> => {
    return container.multiLive.startReadyLives({
      isTikTokConnected: (id) => container.tiktok.getState(id)?.connected === true
    });
  });

  ipcMain.handle(IPC.LIVE_STOP_ALL, async (): Promise<LiveStopAllBatchResult> => {
    return container.multiLive.stopAll();
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
    IPC.LIVE_SET_OUTPUT_MODE,
    async (_event, rawAccountId: unknown, rawMode: unknown) => {
      container.khepree.assertProductAccess();
      const id = accountId(container, rawAccountId);
      const mode = normalizeLiveOutputMode(typeof rawMode === "string" ? rawMode : undefined);
      const license = checkOutputModeLicense(mode, container.khepree.publicState.features ?? {});
      if (!license.allowed) {
        throw new Error(license.reason ?? "OUTPUT_MODE_LICENSE_DENIED");
      }
      container.accountLiveSettings.upsert({ accountId: id, outputMode: mode });
      return container.accountLiveSettings.ensure(id);
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
    container.appEvents.emit("PRODUCTS_CHANGED");
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
    container.appEvents.emit("PRODUCTS_CHANGED");
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
      container.appEvents.emit("LIVE_UPDATED", id);
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
      container.appEvents.emit("LIVE_UPDATED", id);
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
    const state = await container.llm.connect();
    container.appEvents.emit("GEMINI_STATE_CHANGED");
    return state;
  });
  ipcMain.handle(IPC.GEMINI_DISCONNECT, async () => {
    const state = await container.llm.disconnect();
    container.appEvents.emit("GEMINI_STATE_CHANGED");
    return state;
  });
  ipcMain.handle(IPC.GEMINI_REAUTH, async () => {
    container.khepree.assertProductAccess();
    const state = await container.llm.reauth();
    container.appEvents.emit("GEMINI_STATE_CHANGED");
    return state;
  });
  ipcMain.handle(IPC.GEMINI_SET_PROVIDER, async (_event, id: LlmProviderId) => {
    if (id !== "mock" && id !== "gemini-web") throw new Error("LLM_PROVIDER_INVALID");
    await container.llm.setPreferredProvider(id);
    container.appEvents.emit("GEMINI_STATE_CHANGED");
    return container.llm.getPublicState();
  });
  ipcMain.handle(IPC.GEMINI_ACK_DEMO, async () => {
    container.llm.acknowledgeDemoMode();
    container.appEvents.emit("GEMINI_STATE_CHANGED");
    return container.llm.getPublicState();
  });
  ipcMain.handle(IPC.GEMINI_SET_MODEL, async (_event, model: string) => {
    await container.llm.setModel(model);
    container.appEvents.emit("GEMINI_STATE_CHANGED");
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
      const state = await container.llm.saveManualSession(secure1PSID, secure1PSIDTS);
      container.appEvents.emit("GEMINI_STATE_CHANGED");
      return state;
    }
  );
  ipcMain.handle(IPC.GEMINI_CLEAR_SESSION, async () => {
    container.khepree.assertProductAccess();
    const state = await container.llm.clearManualSession();
    container.appEvents.emit("GEMINI_STATE_CHANGED");
    return state;
  });

  ipcMain.handle(IPC.KHEPREE_LOGIN, async () => {
    await container.khepree.startLogin();
    container.appEvents.emit("LICENSE_CHANGED");
  });

  ipcMain.handle(IPC.KHEPREE_LOGOUT, async () => {
    await container.khepree.logout();
    container.appEvents.emit("LICENSE_CHANGED");
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
    const state = await container.tiktok.connect(id);
    container.appEvents.emit("TIKTOK_STATE_CHANGED", id);
    return state;
  });

  ipcMain.handle(IPC.TIKTOK_DISCONNECT, async (_event, rawAccountId: unknown) => {
    const id = accountId(container, rawAccountId);
    const state = await container.tiktok.disconnect(id);
    container.appEvents.emit("TIKTOK_STATE_CHANGED", id);
    return state;
  });

  ipcMain.handle(IPC.LIVE_MANAGER_OPEN, async (_event, rawAccountId: unknown) => {
    container.khepree.assertProductAccess();
    const id = accountId(container, rawAccountId);
    focusAccount(container, id);
    const state = await container.liveManager.open(id);
    container.appEvents.emit("LIVE_MANAGER_STATE_CHANGED", id);
    return state;
  });

  ipcMain.handle(IPC.LIVE_MANAGER_CLOSE, async (_event, rawAccountId: unknown) => {
    const id = accountId(container, rawAccountId);
    const state = await container.liveManager.close(id);
    container.appEvents.emit("LIVE_MANAGER_STATE_CHANGED", id);
    return state;
  });

  ipcMain.handle(IPC.LIVE_MANAGER_REFRESH, async (_event, rawAccountId: unknown) => {
    const id = accountId(container, rawAccountId);
    const state = await container.liveManager.refresh(id);
    container.appEvents.emit("LIVE_MANAGER_STATE_CHANGED", id);
    return state;
  });

  ipcMain.handle(IPC.LIVE_MANAGER_DIAGNOSTIC, async (_event, rawAccountId: unknown) => {
    const id = accountId(container, rawAccountId);
    const state = await container.liveManager.captureDiagnostic(id);
    container.appEvents.emit("LIVE_MANAGER_STATE_CHANGED", id);
    return state;
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

  ipcMain.handle(IPC.MEDIA_LIST_VOICES, async () => {
    return container.mediaFactory.getTts().listVoices();
  });

  ipcMain.handle(IPC.MEDIA_LIST_AUDIO_DEVICES, async () => {
    const exe = resolveAudioBridgeExe(resolveAppRoot());
    if (!exe) return [];
    try {
      return await listAudioDevicesOnce(exe);
    } catch {
      return [];
    }
  });

  ipcMain.handle(IPC.MEDIA_GET_PROFILE, async (_event, rawAccountId: unknown) => {
    const id = accountId(container, rawAccountId);
    const profile = container.mediaProfiles.ensureForAccount(id);
    const settings = container.accountLiveSettings.ensure(id);
    if (settings.mediaProfileId !== profile.id) {
      container.accountLiveSettings.upsert({ accountId: id, mediaProfileId: profile.id });
    }
    return profile;
  });

  ipcMain.handle(
    IPC.MEDIA_SET_PROFILE,
    async (
      _event,
      rawAccountId: unknown,
      patch:
        | {
            voiceId?: string | null;
            rate?: number;
            audioOutputType?: "local-preview" | "windows-endpoint";
            audioOutputDeviceId?: string | null;
            /** Advanced Mode only — allow two shops to share one endpoint. */
            allowDeviceCollision?: boolean;
            avatarEngine?: AvatarEngineSettings;
          }
        | undefined
    ) => {
      const id = accountId(container, rawAccountId);
      const nextType =
        patch?.audioOutputType ??
        container.mediaProfiles.ensureForAccount(id).audioOutputType;
      const nextDevice =
        patch?.audioOutputDeviceId === null
          ? undefined
          : patch?.audioOutputDeviceId !== undefined
            ? patch.audioOutputDeviceId || undefined
            : container.mediaProfiles.ensureForAccount(id).audioOutputDeviceId;

      if (nextType === "windows-endpoint" && nextDevice && !patch?.allowDeviceCollision) {
        const collision = findAudioDeviceCollision(
          id,
          nextDevice,
          container.mediaProfiles.list()
        );
        if (collision) {
          throw new Error(`AUDIO_DEVICE_COLLISION:${collision.otherAccountId}`);
        }
      }

      const next = container.mediaProfiles.upsert({
        accountId: id,
        voiceId: patch?.voiceId === null ? undefined : patch?.voiceId,
        rate: patch?.rate,
        audioOutputType: patch?.audioOutputType,
        audioOutputDeviceId:
          patch?.audioOutputDeviceId === null
            ? undefined
            : patch?.audioOutputDeviceId,
        avatarEngine: patch?.avatarEngine
      });
      container.accountLiveSettings.upsert({ accountId: id, mediaProfileId: next.id });
      return next;
    }
  );

  ipcMain.handle(
    IPC.MEDIA_PROBE_AVATAR_ENGINE,
    async (_event, rawAccountId: unknown) => {
      const id = accountId(container, rawAccountId);
      const profile = container.mediaProfiles.ensureForAccount(id);
      const configured = isAvatarEngineConfigured(profile.avatarEngine);
      if (!configured) {
        return {
          connected: false,
          configured: false,
          health: {
            status: "DOWN" as const,
            message: "not configured",
            checkedAt: new Date().toISOString()
          }
        };
      }
      if (isMuseTalkEngineConfigured(profile.avatarEngine)) {
        const provider = new MuseTalkLocalProvider({
          settings: profile.avatarEngine
        });
        try {
          const health = await provider.health();
          const metrics = provider.getLastMetrics();
          // DEGRADED (sub-realtime) ⇒ not connected for avatar live readiness.
          const connected = health.status === "READY";
          return {
            connected,
            configured: true,
            health,
            probe: metrics
              ? {
                  serverReachable: health.status !== "DOWN",
                  avatarExists: true,
                  sessionStarted: false,
                  audioAccepted: false,
                  outputAvailable: connected,
                  message: health.message ?? "",
                  ...metrics
                }
              : undefined
          };
        } finally {
          await provider.dispose();
        }
      }
      const provider = new ExternalLiveTalkingProvider({
        settings: profile.avatarEngine
      });
      try {
        const health = await provider.health();
        const probe = provider.getLastProbe();
        return {
          connected: Boolean(probe?.serverReachable && probe.avatarExists),
          configured: true,
          health,
          probe
        };
      } finally {
        await provider.dispose();
      }
    }
  );

  ipcMain.handle(IPC.AVATAR_LIST, async () => container.avatarLibrary.list());

  ipcMain.handle(IPC.AVATAR_GET, async (_event, rawId: unknown) => {
    if (typeof rawId !== "string" || !rawId.trim()) return null;
    return container.avatarLibrary.get(rawId.trim()) ?? null;
  });

  ipcMain.handle(
    IPC.AVATAR_CREATE,
    async (
      _event,
      input:
        | {
            name?: string;
            engine?: AvatarAssetEngine;
            sourcePath?: string;
            previewImagePath?: string;
          }
        | undefined
    ) => {
      if (!input?.sourcePath || typeof input.sourcePath !== "string") {
        throw new Error("AVATAR_SOURCE_REQUIRED");
      }
      const engine: AvatarAssetEngine =
        input.engine === "musetalk-local" || input.engine === "livetalking"
          ? input.engine
          : "auto";
      return container.avatarLibrary.create({
        name: typeof input.name === "string" ? input.name : "Avatar",
        engine,
        sourcePath: input.sourcePath,
        previewImagePath:
          typeof input.previewImagePath === "string" ? input.previewImagePath : undefined
      });
    }
  );

  ipcMain.handle(IPC.AVATAR_RENAME, async (_event, rawId: unknown, rawName: unknown) => {
    if (typeof rawId !== "string" || typeof rawName !== "string") {
      throw new Error("AVATAR_RENAME_INVALID");
    }
    return container.avatarLibrary.rename(rawId, rawName);
  });

  ipcMain.handle(IPC.AVATAR_DUPLICATE, async (_event, rawId: unknown) => {
    if (typeof rawId !== "string") throw new Error("AVATAR_ID_REQUIRED");
    return container.avatarLibrary.duplicate(rawId);
  });

  ipcMain.handle(IPC.AVATAR_DELETE, async (_event, rawId: unknown) => {
    if (typeof rawId !== "string") throw new Error("AVATAR_ID_REQUIRED");
    container.avatarLibrary.delete(rawId);
  });

  ipcMain.handle(IPC.AVATAR_PREPROCESS, async (_event, rawId: unknown) => {
    if (typeof rawId !== "string") throw new Error("AVATAR_ID_REQUIRED");
    return container.avatarLibrary.startPreprocess(rawId);
  });

  ipcMain.handle(IPC.AVATAR_PREPROCESS_JOB, async (_event, rawJobId: unknown) => {
    if (typeof rawJobId !== "string") return null;
    return container.avatarLibrary.getJob(rawJobId) ?? null;
  });

  ipcMain.handle(IPC.AVATAR_PICK_VIDEO, async () => {
    const result = await dialog.showOpenDialog({
      title: "Chọn video nhân vật",
      properties: ["openFile"],
      filters: [
        { name: "Video", extensions: ["mp4", "mov", "webm", "mkv"] },
        { name: "All", extensions: ["*"] }
      ]
    });
    if (result.canceled || !result.filePaths[0]) return null;
    return result.filePaths[0];
  });

  ipcMain.handle(
    IPC.AVATAR_SELECT_FOR_ACCOUNT,
    async (_event, rawAccountId: unknown, rawAvatarId: unknown) => {
      const id = accountId(container, rawAccountId);
      const avatarId =
        rawAvatarId === null || rawAvatarId === undefined
          ? undefined
          : typeof rawAvatarId === "string"
            ? rawAvatarId
            : undefined;
      if (avatarId) {
        const asset = container.avatarLibrary.get(avatarId);
        if (!asset) throw new Error("AVATAR_NOT_FOUND");
      }
      return container.mediaProfiles.upsert({
        accountId: id,
        selectedAvatarId: avatarId ?? ""
      });
    }
  );

  ipcMain.handle(
    IPC.AVATAR_TEST_SPEAK,
    async (_event, rawAccountId: unknown, text: unknown) => {
      const id = accountId(container, rawAccountId);
      const sample =
        typeof text === "string" && text.trim()
          ? text.trim()
          : "Xin chào, tôi là nhân vật AI của gian hàng.";
      await container.mediaFactory.preview(id, sample);
    }
  );

  ipcMain.handle(IPC.SCENE_LIST, async () =>
    DEFAULT_SCENES.map((s) => ({ id: s.id, name: s.name }))
  );

  ipcMain.handle(IPC.SCENE_GET_STATE, async (_event, rawAccountId: unknown) => {
    const id = accountId(container, rawAccountId);
    return container.multiLive.ensureRuntime(id).getSceneState();
  });

  ipcMain.handle(
    IPC.SCENE_SET_MANUAL,
    async (_event, rawAccountId: unknown, rawScene: unknown) => {
      const id = accountId(container, rawAccountId);
      if (typeof rawScene !== "string") throw new Error("SCENE_ID_REQUIRED");
      return container.multiLive.ensureRuntime(id).setSceneManual(rawScene);
    }
  );

  ipcMain.handle(IPC.SCENE_CLEAR_OVERRIDE, async (_event, rawAccountId: unknown) => {
    const id = accountId(container, rawAccountId);
    return container.multiLive.ensureRuntime(id).clearSceneOverride();
  });

  ipcMain.handle(
    IPC.SCENE_SET_RESOLUTION,
    async (_event, rawAccountId: unknown, rawPreset: unknown) => {
      const id = accountId(container, rawAccountId);
      const preset = rawPreset === "1080x1920" ? "1080x1920" : "720x1280";
      return container.multiLive.ensureRuntime(id).setSceneResolution(preset);
    }
  );

  ipcMain.handle(
    IPC.SCENE_PREVIEW_FRAME,
    async (_event, rawAccountId: unknown, rawPriority: unknown) => {
      const id = accountId(container, rawAccountId);
      const priority: PreviewPriority =
        rawPriority === "card" || rawPriority === "hidden" || rawPriority === "focused"
          ? rawPriority
          : "focused";
      return container.multiLive.ensureRuntime(id).getScenePreview(priority);
    }
  );

  ipcMain.handle(IPC.MEDIA_READINESS_GET, async (_event, rawAccountId: unknown) => {
    const id = accountId(container, rawAccountId);
    return getMediaReadinessReport(container, id);
  });

  ipcMain.handle(IPC.MEDIA_DRY_RUN, async (_event, rawAccountId: unknown) => {
    const id = accountId(container, rawAccountId);
    return runMediaDryRun(container, id, 0);
  });

  ipcMain.handle(IPC.MEDIA_MULTI_DRY_RUN, async (_event, rawIds: unknown) => {
    let ids: string[] = [];
    if (Array.isArray(rawIds)) {
      ids = rawIds.filter((x): x is string => typeof x === "string" && Boolean(x.trim()));
    }
    if (ids.length === 0) {
      ids = container.multiLive.listAccounts().slice(0, 3).map((a) => a.id);
    }
    return runMediaMultiDryRun(container, ids);
  });

  ipcMain.handle(
    IPC.MEDIA_PREVIEW,
    async (_event, rawAccountId: unknown, text: unknown) => {
      const id = accountId(container, rawAccountId);
      const sample =
        typeof text === "string" && text.trim()
          ? text.trim()
          : "Xin chào, đây là giọng thử của Khepree.";
      await container.mediaFactory.preview(id, sample);
    }
  );

  ipcMain.handle(IPC.MEDIA_ENGINE_STATUS, async () => {
    const tts = container.mediaFactory.getTts();
    const health = await tts.health();
    let voiceCount = 0;
    try {
      voiceCount = (await tts.listVoices()).length;
    } catch {
      voiceCount = 0;
    }
    return {
      providerId: tts.id,
      status: health.status,
      message: health.message,
      voiceCount,
      checkedAt: health.checkedAt
    };
  });

  ipcMain.handle(IPC.OPERATOR_TAKEOVER, async (_event, rawAccountId: unknown) => {
    const id = accountId(container, rawAccountId);
    container.multiLive.enterTakeover(id);
    return container.multiLive.getOperatorControlSnapshot();
  });

  ipcMain.handle(IPC.OPERATOR_EXIT_TAKEOVER, async (_event, rawAccountId: unknown) => {
    const id = accountId(container, rawAccountId);
    container.multiLive.exitTakeover(id);
    return container.multiLive.getOperatorControlSnapshot();
  });

  ipcMain.handle(IPC.OPERATOR_TOGGLE_TAKEOVER, async (_event, rawAccountId: unknown) => {
    const id = accountId(container, rawAccountId);
    container.multiLive.toggleTakeover(id);
    return container.multiLive.getOperatorControlSnapshot();
  });

  ipcMain.handle(IPC.OPERATOR_EMERGENCY_STOP, async () => {
    return container.multiLive.emergencyStopAllAi();
  });

  ipcMain.handle(IPC.OPERATOR_GET_STATE, async () => {
    return container.multiLive.getOperatorControlSnapshot();
  });

  ipcMain.handle(IPC.OPERATOR_SET_HOTKEY, async (_event, raw: unknown) => {
    const hotkey = String(raw ?? "F8");
    container.settings.setTakeoverHotkey(hotkey);
    container.operatorControl.setHotkey(container.settings.getTakeoverHotkey());
    container.appEvents.emit("OPERATOR_CONTROL_CHANGED");
    return container.operatorControl.getHotkey();
  });
}
