import { app } from "electron";
import type Database from "better-sqlite3";
import { openDatabase } from "./db/connection";
import {
  ApprovalRepository,
  LiveEventRepository,
  LiveSessionRepository,
  ProductRepository,
  SettingsRepository
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
import { LiveOrchestrator } from "./live/live-orchestrator";
import { KhepreeAccessService } from "./khepree/khepree-access-service";
import { KhepreeHeartbeatService } from "./khepree/heartbeat-service";
import { assertProductDnaHelpers } from "../shared/product-dna";
import { assertProductImportHelpers } from "../shared/product-import";
import { assertCommentPriorityHelpers } from "../shared/comment-priority";
import { assertSalesBrainContract } from "../shared/sales-brain";
import { assertLiveMemoryHelpers } from "../shared/live-memory";
import { assertSalesScriptHelpers } from "../shared/sales-script";
import { assertApprovalEngineContract } from "./live/approval-engine";
import { resolveAppRoot } from "./app-paths";

export class AppContainer {
  readonly db: Database.Database;
  readonly settings: SettingsRepository;
  readonly products: ProductRepository;
  readonly events: LiveEventRepository;
  readonly approvals: ApprovalRepository;
  readonly sessions: LiveSessionRepository;
  readonly eventBus = new LiveEventBus();
  readonly khepree = new KhepreeAccessService();
  readonly heartbeat = new KhepreeHeartbeatService(this.khepree);
  readonly llm: LlmProviderManager;
  readonly tiktok: TikTokConnectorManager;
  readonly liveManager: LiveManagerManager;
  readonly comments: CommentFeedService;
  readonly media = new MockMediaProvider();
  readonly live: LiveOrchestrator;

  constructor() {
    this.db = openDatabase(app.getPath("userData"));
    this.settings = new SettingsRepository(this.db);
    this.products = new ProductRepository(this.db);
    this.events = new LiveEventRepository(this.db);
    this.approvals = new ApprovalRepository(this.db);
    this.sessions = new LiveSessionRepository(this.db);
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
    this.tiktok = new TikTokConnectorManager({
      appRoot: resolveAppRoot(),
      eventBus: this.eventBus,
      onEvent: (event) => this.events.save(this.live.sessionId ?? null, event),
      getSavedUniqueId: () => this.settings.getTikTokUniqueId(),
      setSavedUniqueId: (id) => this.settings.setTikTokUniqueId(id)
    });
    this.liveManager = new LiveManagerManager({
      eventBus: this.eventBus,
      onEvent: (event) => this.events.save(this.live.sessionId ?? null, event)
    });
    this.comments = new CommentFeedService({ eventBus: this.eventBus });
    this.live = new LiveOrchestrator({
      eventBus: this.eventBus,
      llm: this.llm,
      media: this.media,
      getCurrentProduct: () => this.resolveCurrentProduct(),
      onApprovalChanged: (item) => {
        this.approvals.save(this.live.sessionId ?? null, item);
        this.comments.applyApproval(item);
      },
      onSessionStart: (sessionId, mode) => {
        this.sessions.startWithId(sessionId, mode);
      },
      onSessionEnd: (sessionId, finalState) => {
        this.sessions.end(sessionId, finalState);
      }
    });
  }

  get currentProductId(): string | undefined {
    const stored = this.settings.getCurrentProductId();
    if (stored && this.products.get(stored)) return stored;
    return this.products.list()[0]?.id;
  }

  setCurrentProductId(id: string | undefined): void {
    if (id && !this.products.get(id)) {
      throw new Error("PRODUCT_NOT_FOUND");
    }
    this.settings.setCurrentProductId(id);
  }

  resolveCurrentProduct() {
    const id = this.currentProductId;
    return id ? this.products.get(id) : undefined;
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
    }
    // Packaged builds prefer real Gemini until the operator picks mock demo explicitly.
    if (app.isPackaged && this.settings.get("llm.preferredProvider") === undefined) {
      this.settings.setLlmPreferredProvider("gemini-web");
    }
    this.comments.start();
    await this.khepree.initialize();
    this.heartbeat.start();
  }

  dispose(): void {
    this.live.stop();
    this.comments.stop();
    this.heartbeat.stop();
    void this.llm.dispose();
    void this.tiktok.dispose();
    void this.liveManager.dispose();
    this.db.close();
  }
}
