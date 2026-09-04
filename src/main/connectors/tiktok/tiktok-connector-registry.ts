import type { LiveEventBus } from "../../core/event-bus";
import type { LiveEvent } from "../../../shared/live-types";
import type {
  AccountTikTokState,
  TikTokPublicState
} from "../../../shared/tiktok-contracts";
import { emptyTikTokPublicState } from "../../../shared/tiktok-contracts";
import type { TikTokAccountRepository } from "../../db/repositories";
import type { MultiLiveRuntimeManager } from "../../live/multi-live-runtime-manager";
import {
  TikTokConnectorManager,
  type TikTokConnectorManagerOptions
} from "./tiktok-connector-manager";
import type { TikTokWorkerProvider } from "./tiktok-worker-provider";

export type TikTokConnectorRegistryOptions = {
  appRoot: string;
  accounts: TikTokAccountRepository;
  multiLive: MultiLiveRuntimeManager;
  eventBus: LiveEventBus;
  pythonExecutable?: string;
  startupTimeoutMs?: number;
  /** Test seam — per-account provider factory. */
  createProvider?: (accountId: string) => TikTokWorkerProvider;
  /** Override manager construction (tests). */
  createManager?: (
    opts: TikTokConnectorManagerOptions
  ) => TikTokConnectorManager;
};

/**
 * One TikTokConnectorManager (+ worker process) per TikTok account.
 * Event routing is accountId-hard-bound — never uses focusedAccountId.
 */
export class TikTokConnectorRegistry {
  private readonly connectors = new Map<string, TikTokConnectorManager>();

  constructor(private readonly opts: TikTokConnectorRegistryOptions) {}

  ensure(accountId: string): TikTokConnectorManager {
    const id = accountId.trim();
    if (!id) throw new Error("ACCOUNT_ID_REQUIRED");
    const existing = this.connectors.get(id);
    if (existing) return existing;

    const account = this.opts.accounts.get(id);
    if (!account) throw new Error("TIKTOK_ACCOUNT_NOT_FOUND");

    const managerOpts: TikTokConnectorManagerOptions = {
      accountId: id,
      uniqueId: account.username,
      appRoot: this.opts.appRoot,
      eventBus: this.opts.eventBus,
      pythonExecutable: this.opts.pythonExecutable,
      startupTimeoutMs: this.opts.startupTimeoutMs,
      createProvider: this.opts.createProvider,
      onEvent: (event: LiveEvent) => {
        this.opts.multiLive.ensureRuntime(id).publishEvent(event);
      }
    };

    const manager =
      this.opts.createManager?.(managerOpts) ?? new TikTokConnectorManager(managerOpts);
    this.connectors.set(id, manager);
    return manager;
  }

  get(accountId: string): TikTokConnectorManager | undefined {
    return this.connectors.get(accountId.trim());
  }

  async connect(accountId: string): Promise<TikTokPublicState> {
    const id = accountId.trim();
    if (!id) throw new Error("ACCOUNT_ID_REQUIRED");

    const account = this.opts.accounts.get(id);
    if (!account) throw new Error("TIKTOK_ACCOUNT_NOT_FOUND");
    if (!account.enabled) throw new Error("ACCOUNT_DISABLED");

    const connector = this.ensure(id);
    const state = await connector.connect(account.username);
    this.opts.accounts.update(id, {
      lastConnectedAt: new Date().toISOString()
    });
    return state;
  }

  async disconnect(accountId: string): Promise<TikTokPublicState> {
    const id = accountId.trim();
    if (!id) throw new Error("ACCOUNT_ID_REQUIRED");
    if (!this.opts.accounts.get(id)) throw new Error("TIKTOK_ACCOUNT_NOT_FOUND");

    const connector = this.connectors.get(id);
    if (!connector) return emptyTikTokPublicState();
    return connector.disconnect();
  }

  getState(accountId: string): AccountTikTokState | undefined {
    return this.connectors.get(accountId.trim())?.getAccountState();
  }

  getAllStates(): AccountTikTokState[] {
    return [...this.connectors.values()].map((c) => c.getAccountState());
  }

  /** Deprecated UI shim — focused account's connector only. */
  getPublicState(accountId?: string): TikTokPublicState {
    if (!accountId) return emptyTikTokPublicState();
    return this.connectors.get(accountId)?.getPublicState() ?? emptyTikTokPublicState();
  }

  async health(accountId?: string) {
    if (accountId) {
      const c = this.connectors.get(accountId.trim());
      if (c) return c.health();
    }
    // Aggregate: any CONNECTED → OK; else first connector health or DISABLED.
    for (const c of this.connectors.values()) {
      const h = await c.health();
      if (h.status === "OK") return h;
    }
    const first = this.connectors.values().next().value as TikTokConnectorManager | undefined;
    if (first) return first.health();
    return {
      component: "tiktok:tiktoklive",
      status: "DISABLED" as const,
      message: "no connectors",
      checkedAt: new Date().toISOString()
    };
  }

  async disposeAccount(accountId: string): Promise<void> {
    const id = accountId.trim();
    const connector = this.connectors.get(id);
    if (!connector) return;
    await connector.dispose();
    this.connectors.delete(id);
  }

  async disposeAll(): Promise<void> {
    for (const id of [...this.connectors.keys()]) {
      await this.disposeAccount(id);
    }
  }

  /** Alias for AppContainer.dispose compatibility. */
  async dispose(): Promise<void> {
    await this.disposeAll();
  }
}
