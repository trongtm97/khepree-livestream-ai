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
  AccountLiveSettingsRepository
} from "./db/repositories";
import { LiveEventBus } from "./core/event-bus";
import {
  assertLlmProviderManagerContract,
  LlmProviderManager
} from "./connectors/llm/llm-provider-manager";
import {
  assertTikTokConnectorContract,
  TikTokConnectorManager
} from "./connectors/tiktok/tiktok-connector-manager";
import {
  assertLiveManagerContract,
  LiveManagerManager
} from "./connectors/tiktok/live-manager-manager";
import { MockMediaProvider } from "./connectors/media/mock-media-provider";
import { CommentFeedService } from "./live/comment-feed-service";
import { MultiLiveRuntimeManager } from "./live/multi-live-runtime-manager";
import { KhepreeAccessService } from "./khepree/khepree-access-service";
import { KhepreeHeartbeatService } from "./khepree/heartbeat-service";
import { assertProductDnaHelpers } from "../shared/product-dna";
import { assertProductImportHelpers } from "../shared/product-import";
import { assertCommentPriorityHelpers } from "../shared/comment-priority";
import { assertSalesBrainContract } from "../shared/sales-brain";
import { assertLiveMemoryHelpers } from "../shared/live-memory";
import { assertSalesScriptHelpers } from "../shared/sales-script";
import { assertApprovalEngineContract } from "./live/approval-engine";
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
  /** Fan-in bus for UI comment feed (events forwarded from each LiveRuntime). */
  readonly eventBus = new LiveEventBus();
  readonly khepree = new KhepreeAccessService();
  readonly heartbeat = new KhepreeHeartbeatService(this.khepree);
  readonly llm: LlmProviderManager;
  readonly tiktok: TikTokConnectorManager;
  readonly liveManager: LiveManagerManager;
  readonly comments: CommentFeedService;
  /** Shared mock until per-runtime media sessions are fully specialized. */
  readonly media = new MockMediaProvider();
  readonly multiLive: MultiLiveRuntimeManager;

  constructor() {
    this.db = openDatabase(app.getPath("userData"));
    this.settings = new SettingsRepository(this.db);
    this.products = new ProductRepository(this.db);
    this.events = new LiveEventRepository(this.db);
    this.approvals = new ApprovalRepository(this.db);
    this.sessions = new LiveSessionRepository(this.db);
    this.tiktokAccounts = new TikTokAccountRepository(this.db);
    this.accountLiveSettings = new AccountLiveSettingsRepository(this.db);

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

    this.comments = new CommentFeedService({ eventBus: this.eventBus });

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
      llm: this.llm,
      createMedia: () => new MockMediaProvider(),
      assertProductAccess: (feature) => this.khepree.assertProductAccess(feature),
      onEvent: (event) => this.eventBus.publish(event),
      onApprovalChanged: (item) => this.comments.applyApproval(item)
    });

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
    this.tiktok = new TikTokConnectorManager({
      appRoot: resolveAppRoot(),
      eventBus: connectorSink,
      onEvent: (event) => {
        const accountId = this.requireFocusedOrThrow();
        this.multiLive.ensureRuntime(accountId).publishEvent({
          ...event,
          accountId
        });
      },
      getSavedUniqueId: () => this.settings.getTikTokUniqueId(),
      setSavedUniqueId: (id) => this.settings.setTikTokUniqueId(id)
    });
    this.liveManager = new LiveManagerManager({
      eventBus: connectorSink,
      onEvent: (event) => {
        const accountId = this.requireFocusedOrThrow();
        this.multiLive.ensureRuntime(accountId).publishEvent({
          ...event,
          accountId
        });
      }
    });
  }

  async initialize(): Promise<void> {
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
      assertSalesScriptHelpers();
      assertTikTokAccountHelpers();
    }
    if (app.isPackaged && this.settings.get("llm.preferredProvider") === undefined) {
      this.settings.setLlmPreferredProvider("gemini-web");
    }
    this.comments.start();
    await this.khepree.initialize();
    this.heartbeat.start();
  }

  dispose(): void {
    this.multiLive.dispose();
    this.comments.stop();
    this.heartbeat.stop();
    void this.llm.dispose();
    void this.tiktok.dispose();
    void this.liveManager.dispose();
    this.db.close();
  }

  private requireFocusedOrThrow(): string {
    const id = this.multiLive.focusedId;
    if (!id) throw new Error("ACCOUNT_ID_REQUIRED");
    return id;
  }
}

/**
 * Migrate legacy tiktok.uniqueId / products.currentId into tiktok_accounts once.
 * Does not set focused account in production and does not start live.
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
