import type { LiveEventBus } from "../../core/event-bus";
import type { LiveEvent } from "../../../shared/live-types";
import type {
  AccountLiveManagerState,
  LiveManagerPublicState
} from "../../../shared/live-manager-contracts";
import { emptyLiveManagerPublicState } from "../../../shared/live-manager-contracts";
import type { TikTokAccountRepository } from "../../db/repositories";
import type { MultiLiveRuntimeManager } from "../../live/multi-live-runtime-manager";
import {
  LiveManagerManager,
  type LiveManagerManagerOptions,
  type LiveManagerObserverFactoryArgs
} from "./live-manager-manager";
import type { LiveManagerObserver } from "./live-manager-observer";

export type LiveManagerRegistryOptions = {
  accounts: TikTokAccountRepository;
  multiLive: MultiLiveRuntimeManager;
  eventBus: LiveEventBus;
  userDataDir?: string;
  appRoot?: string;
  createObserver?: (args: LiveManagerObserverFactoryArgs) => LiveManagerObserver;
  createManager?: (opts: LiveManagerManagerOptions) => LiveManagerManager;
};

/**
 * One LiveManagerManager (+ browser profile) per TikTok account.
 * Open B never closes A. Event routing is accountId-hard-bound.
 */
export class LiveManagerRegistry {
  private readonly managers = new Map<string, LiveManagerManager>();

  constructor(private readonly opts: LiveManagerRegistryOptions) {}

  ensure(accountId: string): LiveManagerManager {
    const id = accountId.trim();
    if (!id) throw new Error("ACCOUNT_ID_REQUIRED");
    const existing = this.managers.get(id);
    if (existing) return existing;

    const account = this.opts.accounts.get(id);
    if (!account) throw new Error("TIKTOK_ACCOUNT_NOT_FOUND");
    if (!account.enabled) throw new Error("ACCOUNT_DISABLED");

    const managerOpts: LiveManagerManagerOptions = {
      accountId: id,
      profileKey: account.profileKey,
      eventBus: this.opts.eventBus,
      userDataDir: this.opts.userDataDir,
      appRoot: this.opts.appRoot,
      createObserver: this.opts.createObserver,
      onEvent: (event: LiveEvent) => {
        // accountId already stamped by manager; publishEvent adds sessionId when live.
        this.opts.multiLive.ensureRuntime(id).publishEvent(event);
      }
    };

    const manager =
      this.opts.createManager?.(managerOpts) ?? new LiveManagerManager(managerOpts);
    this.managers.set(id, manager);
    return manager;
  }

  get(accountId: string): LiveManagerManager | undefined {
    return this.managers.get(accountId.trim());
  }

  async open(accountId: string): Promise<LiveManagerPublicState> {
    const id = accountId.trim();
    if (!id) throw new Error("ACCOUNT_ID_REQUIRED");

    const account = this.opts.accounts.get(id);
    if (!account) throw new Error("TIKTOK_ACCOUNT_NOT_FOUND");
    if (!account.enabled) throw new Error("ACCOUNT_DISABLED");

    const manager = this.ensure(id);
    return manager.open(account.profileKey);
  }

  async close(accountId: string): Promise<LiveManagerPublicState> {
    const id = accountId.trim();
    if (!id) throw new Error("ACCOUNT_ID_REQUIRED");
    if (!this.opts.accounts.get(id)) throw new Error("TIKTOK_ACCOUNT_NOT_FOUND");

    const manager = this.managers.get(id);
    if (!manager) return emptyLiveManagerPublicState();
    return manager.close();
  }

  async refresh(accountId: string): Promise<LiveManagerPublicState> {
    const manager = this.requireManager(accountId);
    return manager.refresh();
  }

  async captureDiagnostic(accountId: string): Promise<LiveManagerPublicState> {
    const manager = this.requireManager(accountId);
    return manager.captureDiagnostic();
  }

  getState(accountId: string): AccountLiveManagerState | undefined {
    return this.managers.get(accountId.trim())?.getAccountState();
  }

  getAllStates(): AccountLiveManagerState[] {
    return [...this.managers.values()].map((m) => m.getAccountState());
  }

  /** Deprecated UI shim — focused account only. */
  getPublicState(accountId?: string): LiveManagerPublicState {
    if (!accountId) return emptyLiveManagerPublicState();
    return this.managers.get(accountId)?.getPublicState() ?? emptyLiveManagerPublicState();
  }

  async health(accountId?: string) {
    if (accountId) {
      const m = this.managers.get(accountId.trim());
      if (m) return m.health();
    }
    for (const m of this.managers.values()) {
      const h = await m.health();
      if (h.status === "OK" || h.status === "DEGRADED") return h;
    }
    const first = this.managers.values().next().value as LiveManagerManager | undefined;
    if (first) return first.health();
    return {
      component: "tiktok:live-manager",
      status: "DISABLED" as const,
      message: "no managers",
      checkedAt: new Date().toISOString()
    };
  }

  async dispose(accountId: string): Promise<void> {
    const id = accountId.trim();
    const manager = this.managers.get(id);
    if (!manager) return;
    await manager.dispose();
    this.managers.delete(id);
  }

  async disposeAll(): Promise<void> {
    for (const id of [...this.managers.keys()]) {
      await this.dispose(id);
    }
  }

  private requireManager(accountId: string): LiveManagerManager {
    const id = accountId.trim();
    if (!id) throw new Error("ACCOUNT_ID_REQUIRED");
    if (!this.opts.accounts.get(id)) throw new Error("TIKTOK_ACCOUNT_NOT_FOUND");
    const manager = this.managers.get(id);
    if (!manager) throw new Error("BROWSER_SESSION_FAILED:not open");
    return manager;
  }
}
