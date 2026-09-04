import { app } from "electron";
import type Database from "better-sqlite3";
import { openDatabase } from "./db/connection";
import {
  ApprovalRepository,
  LiveEventRepository,
  LiveSessionRepository,
  ProductRepository,
  SettingsRepository,
  TikTokAccountRepository,
  AccountLiveSettingsRepository,
  MediaProfileRepository,
  AvatarAssetRepository
} from "./db/repositories";
import { LiveEventBus } from "./core/event-bus";
import { AppEventHub } from "./core/app-event-hub";
import {
  assertLlmProviderManagerContract,
  LlmProviderManager
} from "./connectors/llm/llm-provider-manager";
import {
  assertTikTokConnectorContract
} from "./connectors/tiktok/tiktok-connector-manager";
import { TikTokConnectorRegistry } from "./connectors/tiktok/tiktok-connector-registry";
import {
  assertLiveManagerContract
} from "./connectors/tiktok/live-manager-manager";
import { LiveManagerRegistry } from "./connectors/tiktok/live-manager-registry";
import { MediaSessionFactory } from "./connectors/media/media-session-factory";
import { ExternalLiveTalkingProvider } from "./connectors/media/avatar/external-livetalking-provider";
import { MuseTalkLocalProvider } from "./connectors/media/avatar/musetalk-local-provider";
import { AvatarLibraryService } from "./connectors/media/avatar/avatar-library-service";
import {
  isAvatarEngineConfigured,
  isLiveTalkingEngineConfigured,
  isMuseTalkEngineConfigured
} from "../shared/media-contracts";
import {
  isOutputModeReady,
  missingCapabilitiesForMode,
  resolveMediaCapabilities
} from "../shared/live-output-mode";
import { OperatorControlService } from "./live/operator-control-service";
import { CommentFeedService } from "./live/comment-feed-service";
import { MultiLiveRuntimeManager } from "./live/multi-live-runtime-manager";
import { AiRequestScheduler } from "./live/ai-request-scheduler";
import {
  capabilityFromAvatarEngine,
  GpuMediaScheduler
} from "./live/gpu-media-scheduler";
import { LiveCapacityService } from "./live/live-capacity-service";
import {
  createOsResourceGovernor,
  type OsResourceGovernor,
  type ResourceSnapshot
} from "./live/resource-governor";
import {
  LiveSessionRecoveryService,
  type SessionRecoveryReport
} from "./live/live-session-recovery";
import { LIVE_SESSION_CRASH_RECOVERED } from "../shared/live-types";
import { KhepreeAccessService } from "./khepree/khepree-access-service";
import { KhepreeHeartbeatService } from "./khepree/heartbeat-service";
import { assertProductDnaHelpers } from "../shared/product-dna";
import { assertProductImportHelpers } from "../shared/product-import";
import { assertCommentPriorityHelpers } from "../shared/comment-priority";
import { assertSalesBrainContract } from "../shared/sales-brain";
import { assertLiveMemoryHelpers } from "../shared/live-memory";
import { assertSalesScriptHelpers } from "../shared/sales-script";
import { assertApprovalEngineContract } from "./live/approval-engine";
import { assertLiveEventDeduplicator } from "./live/live-event-deduplicator";
import { assertTikTokAccountHelpers } from "../shared/tiktok-account";
import { resolveAppRoot } from "./app-paths";

/**
 * Shared process services + MultiLiveRuntimeManager.
 * No global LiveOrchestrator / currentProductId — live state lives per account runtime.
 */
export class AppContainer {
  readonly db: Database.Database;
  readonly settings: SettingsRepository;
  readonly products: ProductRepository;
  readonly events: LiveEventRepository;
  readonly approvals: ApprovalRepository;
  readonly sessions: LiveSessionRepository;
  readonly tiktokAccounts: TikTokAccountRepository;
  readonly accountLiveSettings: AccountLiveSettingsRepository;
  readonly mediaProfiles: MediaProfileRepository;
  readonly avatarAssets: AvatarAssetRepository;
  readonly avatarLibrary: AvatarLibraryService;
  /** Fan-in bus for UI comment feed (events forwarded from each LiveRuntime). */
  readonly eventBus = new LiveEventBus();
  /** Realtime UI notifications (no secrets). */
  readonly appEvents = new AppEventHub();
  readonly khepree = new KhepreeAccessService();
  readonly heartbeat = new KhepreeHeartbeatService(this.khepree);
  readonly llm: LlmProviderManager;
  /**
   * Fair AI queue between LiveRuntime(s) and LlmProviderManager.
   * Does not replace Gemini circuit breaker / session / models.
   */
  readonly aiScheduler: AiRequestScheduler;
  /**
   * Avatar GPU capacity — separate from AiRequestScheduler (Gemini).
   * Admission before AVATAR_LIVE; suggests Voice Only when full.
   */
  readonly gpuMediaScheduler: GpuMediaScheduler;
  /** Per-account TikTok connectors (one worker process each). */
  readonly tiktok: TikTokConnectorRegistry;
  /** Per-account LIVE Manager browsers (one profile each). */
  readonly liveManager: LiveManagerRegistry;
  readonly comments: CommentFeedService;
  /** Per-account voice MediaSession factory (Windows SAPI by default). */
  readonly mediaFactory: MediaSessionFactory;
  readonly operatorControl: OperatorControlService;
  /** Aggregate media health for snapshot (TTS engine, not avatar). */
  get media() {
    return {
      health: async () => {
        const h = await this.mediaFactory.getTts().health();
        return {
          ...h,
          component: h.component.startsWith("tts:")
            ? h.component.replace(/^tts:/, "media:")
            : `media:${h.component}`
        };
      }
    };
  }
  /** License limits ≠ hardware capacity — never mixed. */
  readonly capacity: LiveCapacityService;
  private readonly resourceGovernor: OsResourceGovernor;
  readonly multiLive: MultiLiveRuntimeManager;
  /** Last startup crash-recovery report (empty when nothing stale). */
  private sessionRecovery: SessionRecoveryReport = {
    recoveredCount: 0,
    sessionIds: [],
    accountIds: [],
    recoveredAt: new Date(0).toISOString(),
    reason: LIVE_SESSION_CRASH_RECOVERED
  };

  constructor() {
    this.db = openDatabase(app.getPath("userData"));
    this.settings = new SettingsRepository(this.db);
    this.products = new ProductRepository(this.db);
    this.events = new LiveEventRepository(this.db);
    this.approvals = new ApprovalRepository(this.db);
    this.sessions = new LiveSessionRepository(this.db);
    this.tiktokAccounts = new TikTokAccountRepository(this.db);
    this.accountLiveSettings = new AccountLiveSettingsRepository(this.db);
    this.mediaProfiles = new MediaProfileRepository(this.db);
    this.avatarAssets = new AvatarAssetRepository(this.db);

    this.mediaFactory = new MediaSessionFactory({
      appRoot: resolveAppRoot(),
      getProfile: (accountId) => {
        const profile = this.mediaProfiles.ensureForAccount(accountId);
        const settings = this.accountLiveSettings.ensure(accountId);
        if (settings.mediaProfileId !== profile.id) {
          this.accountLiveSettings.upsert({
            accountId,
            mediaProfileId: profile.id
          });
        }
        return profile;
      },
      createAvatar: (accountId) => {
        const profile = this.mediaProfiles.ensureForAccount(accountId);
        if (isMuseTalkEngineConfigured(profile.avatarEngine)) {
          return new MuseTalkLocalProvider({ settings: profile.avatarEngine });
        }
        if (isLiveTalkingEngineConfigured(profile.avatarEngine)) {
          return new ExternalLiveTalkingProvider({ settings: profile.avatarEngine });
        }
        return undefined;
      }
    });

    this.operatorControl = new OperatorControlService({
      takeoverHotkey: this.settings.getTakeoverHotkey()
    });

    seedLegacyTikTokAccountIfNeeded(
      this.tiktokAccounts,
      this.accountLiveSettings,
      this.settings
    );

    this.llm = new LlmProviderManager({
      appRoot: resolveAppRoot(),
      getPreferredProvider: () => this.settings.getLlmPreferredProvider(),
      setPreferredProvider: (id) => this.settings.setLlmPreferredProvider(id),
      getDemoAcknowledged: () => this.settings.getLlmDemoAcknowledged(),
      setDemoAcknowledged: (v) => this.settings.setLlmDemoAcknowledged(v),
      getSelectedModel: () => this.settings.getGeminiSelectedModel(),
      setSelectedModel: (m) => this.settings.setGeminiSelectedModel(m),
      getLocale: () => this.settings.getLocale()
    });

    this.aiScheduler = new AiRequestScheduler({ provider: this.llm });

    this.comments = new CommentFeedService({
      eventBus: this.eventBus,
      onCommentIngested: (accountId) => {
        this.appEvents.emit("COMMENT_RECEIVED", accountId);
      }
    });

    this.resourceGovernor = createOsResourceGovernor();
    this.gpuMediaScheduler = new GpuMediaScheduler({
      getGpuSnapshot: () => this.resourceGovernor.snapshot({
        activeRuntimes: 0,
        activeTikTokWorkers: 0,
        activeBrowserContexts: 0,
        aiQueueLength: 0
      }).gpu
      // maxAvatarSlots unset in production — VRAM/util from SystemResourceMonitor when known.
    });
    this.capacity = new LiveCapacityService({
      getFeatures: () => this.khepree.publicState.features,
      isLicenseActive: () => this.khepree.publicState.status === "ACTIVE",
      governor: this.resourceGovernor
    });

    this.multiLive = new MultiLiveRuntimeManager({
      accounts: this.tiktokAccounts,
      accountLiveSettings: this.accountLiveSettings,
      repositories: {
        products: this.products,
        events: this.events,
        approvals: this.approvals,
        sessions: this.sessions,
        accountLiveSettings: this.accountLiveSettings
      },
      llm: this.aiScheduler,
      createMedia: (accountId) => this.mediaFactory.create(accountId),
      operatorControl: this.operatorControl,
      onOperatorControlChanged: (accountId) => {
        this.appEvents.emit("OPERATOR_CONTROL_CHANGED", accountId);
      },
      assertProductAccess: (feature) => this.khepree.assertProductAccess(feature),
      assertReadyToStart: (account) => {
        const settings = this.accountLiveSettings.ensure(account.id);
        const profile = this.mediaProfiles.getByAccount(account.id);
        const caps = resolveMediaCapabilities({
          ttsStatus: "UNKNOWN",
          audioOutputType: profile?.audioOutputType,
          audioOutputDeviceId: profile?.audioOutputDeviceId,
          avatarReady: isAvatarEngineConfigured(profile?.avatarEngine),
          videoRouteReady:
            isLiveTalkingEngineConfigured(profile?.avatarEngine) &&
            profile?.avatarEngine.transport === "virtualcam"
        });
        if (!isOutputModeReady(settings.outputMode, caps)) {
          const missing = missingCapabilitiesForMode(settings.outputMode, caps).join(",");
          throw new Error(`OUTPUT_MODE_NOT_READY:${missing || settings.outputMode}`);
        }
        if (settings.outputMode === "AVATAR_LIVE") {
          const gpuCap = capabilityFromAvatarEngine({
            kind: profile?.avatarEngine?.kind ?? "none"
          });
          // Reserve slot now so concurrent starts cannot over-admit.
          this.gpuMediaScheduler.registerSession({
            accountId: account.id,
            model: gpuCap.model,
            targetFps: gpuCap.maxTargetFps,
            priority: "speaking",
            estimatedVramMb: gpuCap.estimatedVramMb,
            qualityTier: gpuCap.qualityTier,
            capacitySlots: gpuCap.capacitySlots,
            modelLoaded: gpuCap.modelLoaded,
            supportsIdlePrerecorded: gpuCap.supportsIdlePrerecorded
          });
        }
      },
      capacity: this.capacity,
      getResourceExtras: () => ({
        activeTikTokWorkers: this.tiktok
          .getAllStates()
          .filter((s) => s.connected || s.phase === "CONNECTING" || s.phase === "RECONNECTING")
          .length,
        activeBrowserContexts: this.liveManager
          .getAllStates()
          .filter((s) => s.phase !== "CLOSED")
          .length,
        aiQueueLength: this.aiScheduler.getMetrics().queueLength
      }),
      onEvent: (event) => this.eventBus.publish(event),
      onApprovalChanged: (item) => {
        this.comments.applyApproval(item);
        this.appEvents.emit("APPROVAL_UPDATED", item.accountId);
      },
      onLiveStarted: (accountId, sessionId) => {
        this.aiScheduler.bindSession(accountId, sessionId);
        this.appEvents.emit("LIVE_UPDATED", accountId);
      },
      onReadyStartFailed: (accountId) => {
        this.gpuMediaScheduler.unregisterSession(accountId);
      },
      onLiveStopped: (accountId) => {
        this.gpuMediaScheduler.unregisterSession(accountId);
        this.aiScheduler.unbindSession(accountId);
        this.aiScheduler.cancelAccount(accountId);
        this.appEvents.emit("LIVE_UPDATED", accountId);
      }
    });

    this.avatarLibrary = new AvatarLibraryService(
      this.avatarAssets,
      this.mediaProfiles,
      this.multiLive,
      app.getPath("userData")
    );

    // Restore focused account (persisted); unpackaged may fall back to first account for UI.
    const savedFocus = this.settings.getFocusedAccountId();
    if (savedFocus && this.tiktokAccounts.get(savedFocus)) {
      this.multiLive.setFocusedAccountId(savedFocus);
    } else if (!app.isPackaged) {
      const first = this.tiktokAccounts.list()[0];
      if (first) {
        this.multiLive.setFocusedAccountId(first.id);
        this.settings.setFocusedAccountId(first.id);
      }
    }

    const connectorSink = new LiveEventBus();
    this.tiktok = new TikTokConnectorRegistry({
      appRoot: resolveAppRoot(),
      accounts: this.tiktokAccounts,
      multiLive: this.multiLive,
      eventBus: connectorSink
    });

    this.liveManager = new LiveManagerRegistry({
      accounts: this.tiktokAccounts,
      multiLive: this.multiLive,
      eventBus: connectorSink
    });
  }

  async initialize(): Promise<void> {
    // Process just started — no in-memory runtime owns prior DB sessions.
    this.sessionRecovery = new LiveSessionRecoveryService(this.sessions).recoverOnStartup();

    if (!app.isPackaged) {
      assertProductDnaHelpers();
      assertProductImportHelpers();
      assertLlmProviderManagerContract();
      assertTikTokConnectorContract();
      assertLiveManagerContract();
      assertCommentPriorityHelpers();
      assertSalesBrainContract();
      assertLiveMemoryHelpers();
      assertApprovalEngineContract();
      assertLiveEventDeduplicator();
      assertSalesScriptHelpers();
      assertTikTokAccountHelpers();
    }
    if (app.isPackaged && this.settings.get("llm.preferredProvider") === undefined) {
      this.settings.setLlmPreferredProvider("gemini-web");
    }
    this.comments.start();
    this.resourceGovernor.start();
    await this.khepree.initialize();
    this.heartbeat.start();
  }

  /** Hardware metrics for UI — never blocks; UNKNOWN is fine. */
  getResourceSnapshot(): ResourceSnapshot {
    const extras = {
      activeTikTokWorkers: this.tiktok
        .getAllStates()
        .filter((s) => s.connected || s.phase === "CONNECTING" || s.phase === "RECONNECTING")
        .length,
      activeBrowserContexts: this.liveManager
        .getAllStates()
        .filter((s) => s.phase !== "CLOSED")
        .length,
      aiQueueLength: this.aiScheduler.getMetrics().queueLength
    };
    return this.capacity.resourceSnapshot({
      activeRuntimes: this.multiLive.getAllSnapshots().filter((s) => s.isRunning).length,
      accountCount: this.tiktokAccounts.list().length,
      ...extras
    });
  }

  getSessionRecoveryReport(): SessionRecoveryReport {
    return this.sessionRecovery;
  }

  dispose(): void {
    this.resourceGovernor.stop();
    this.multiLive.dispose();
    this.aiScheduler.cancelAll();
    this.comments.stop();
    this.heartbeat.stop();
    void this.llm.dispose();
    void this.tiktok.dispose();
    void this.liveManager.disposeAll();
    this.db.close();
  }
}

/**
 * Migrate legacy tiktok.uniqueId / products.currentId into tiktok_accounts once.
 * Does not set focused account in production and does not start live.
 * After migration, runtime connect uses TikTokAccountRepository.username only.
 */
export function seedLegacyTikTokAccountIfNeeded(
  accounts: TikTokAccountRepository,
  accountSettings: AccountLiveSettingsRepository,
  appSettings: SettingsRepository
): void {
  if (accounts.list().length > 0) {
    const existing = accounts.list()[0]!;
    const settings = accountSettings.ensure(existing.id);
    const legacyProduct = appSettings.getCurrentProductId();
    if (!settings.currentProductId && legacyProduct) {
      accountSettings.upsert({
        accountId: existing.id,
        currentProductId: legacyProduct
      });
    }
    return;
  }

  const uniqueId = appSettings.getTikTokUniqueId();
  if (!uniqueId) return;

  const created = accounts.create({
    username: uniqueId,
    label: "Primary"
  });
  const legacyProduct = appSettings.getCurrentProductId();
  accountSettings.ensure(created.id);
  if (legacyProduct) {
    accountSettings.upsert({
      accountId: created.id,
      currentProductId: legacyProduct
    });
  }
}
