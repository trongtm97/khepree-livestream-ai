import { app } from "electron";
import type Database from "better-sqlite3";
import { openDatabase } from "./db/connection";
import { ApprovalRepository, LiveEventRepository, ProductRepository } from "./db/repositories";
import { LiveEventBus } from "./core/event-bus";
import { MockLlmProvider } from "./connectors/llm/mock-llm-provider";
import { MockMediaProvider } from "./connectors/media/mock-media-provider";
import { LiveOrchestrator } from "./live/live-orchestrator";
import { KhepreeAccessService } from "./khepree/khepree-access-service";
import { KhepreeHeartbeatService } from "./khepree/heartbeat-service";

export class AppContainer {
  readonly db: Database.Database;
  readonly products: ProductRepository;
  readonly events: LiveEventRepository;
  readonly approvals: ApprovalRepository;
  readonly eventBus = new LiveEventBus();
  readonly khepree = new KhepreeAccessService();
  readonly heartbeat = new KhepreeHeartbeatService(this.khepree);
  readonly llm = new MockLlmProvider();
  readonly media = new MockMediaProvider();
  readonly live: LiveOrchestrator;
  currentProductId?: string;

  constructor() {
    this.db = openDatabase(app.getPath("userData"));
    this.products = new ProductRepository(this.db);
    this.events = new LiveEventRepository(this.db);
    this.approvals = new ApprovalRepository(this.db);
    this.live = new LiveOrchestrator({
      eventBus: this.eventBus,
      llm: this.llm,
      media: this.media,
      getCurrentProduct: () =>
        this.currentProductId ? this.products.get(this.currentProductId) : this.products.list()[0],
      onApprovalChanged: (item) => this.approvals.save(null, item)
    });
  }

  async initialize(): Promise<void> {
    await this.khepree.initialize();
    this.heartbeat.start();
  }

  dispose(): void {
    this.live.stop();
    this.heartbeat.stop();
    this.db.close();
  }
}
