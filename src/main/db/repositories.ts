import type Database from "better-sqlite3";
import {
  DEFAULT_APP_LOCALE,
  normalizeAppLocale,
  type AppLocale
} from "../../shared/locale";
import {
  normalizeOnboardingState,
  normalizeOnboardingStep,
  type OnboardingState
} from "../../shared/onboarding";
import type {
  AccountLiveSettings,
  ApprovalItem,
  AutomationMode,
  LiveEvent,
  LiveSession,
  ProductDNA,
  TikTokAccount
} from "../../shared/live-types";
import { normalizeProduct } from "../../shared/product-dna";
import {
  assertSafeProfileKey,
  buildTikTokAccount,
  DEFAULT_ACCOUNT_AUTOMATION_MODE,
  normalizeTikTokUsername,
  type CreateTikTokAccountInput
} from "../../shared/tiktok-account";
import { getSchemaVersion } from "./connection";

const UI_LOCALE_KEY = "ui.locale";
const ONBOARDING_COMPLETED_KEY = "onboarding.completed";
const ONBOARDING_STEP_KEY = "onboarding.currentStep";
const CURRENT_PRODUCT_KEY = "products.currentId";
const LLM_PREFERRED_KEY = "llm.preferredProvider";
const LLM_DEMO_ACK_KEY = "llm.demoAcknowledged";
const GEMINI_MODEL_KEY = "gemini.selectedModel";
const TIKTOK_UNIQUE_ID_KEY = "tiktok.uniqueId";
const FOCUSED_ACCOUNT_KEY = "ui.focusedAccountId";

export class SettingsRepository {
  constructor(private readonly db: Database.Database) {}

  get(key: string): string | undefined {
    const row = this.db.prepare("SELECT value FROM app_meta WHERE key=?").get(key) as
      | { value: string }
      | undefined;
    return row?.value;
  }

  set(key: string, value: string): void {
    this.db.prepare(`
      INSERT INTO app_meta(key, value)
      VALUES(?, ?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value
    `).run(key, value);
  }

  getLocale(): AppLocale {
    const raw = this.get(UI_LOCALE_KEY);
    return raw === undefined ? DEFAULT_APP_LOCALE : normalizeAppLocale(raw);
  }

  setLocale(locale: AppLocale): void {
    this.set(UI_LOCALE_KEY, normalizeAppLocale(locale));
  }

  getOnboarding(): OnboardingState {
    return normalizeOnboardingState({
      completed: this.get(ONBOARDING_COMPLETED_KEY) === "1",
      currentStep: normalizeOnboardingStep(this.get(ONBOARDING_STEP_KEY) ?? 1)
    });
  }

  setOnboarding(state: OnboardingState): OnboardingState {
    const next = normalizeOnboardingState(state);
    this.set(ONBOARDING_COMPLETED_KEY, next.completed ? "1" : "0");
    this.set(ONBOARDING_STEP_KEY, String(next.currentStep));
    return next;
  }

  getCurrentProductId(): string | undefined {
    return this.get(CURRENT_PRODUCT_KEY);
  }

  setCurrentProductId(id: string | undefined): void {
    if (!id) {
      this.db.prepare("DELETE FROM app_meta WHERE key=?").run(CURRENT_PRODUCT_KEY);
      return;
    }
    this.set(CURRENT_PRODUCT_KEY, id);
  }

  getLlmPreferredProvider(): "mock" | "gemini-web" {
    const raw = this.get(LLM_PREFERRED_KEY);
    return raw === "gemini-web" ? "gemini-web" : "mock";
  }

  setLlmPreferredProvider(id: "mock" | "gemini-web"): void {
    this.set(LLM_PREFERRED_KEY, id === "gemini-web" ? "gemini-web" : "mock");
  }

  getLlmDemoAcknowledged(): boolean {
    return this.get(LLM_DEMO_ACK_KEY) === "1";
  }

  setLlmDemoAcknowledged(value: boolean): void {
    this.set(LLM_DEMO_ACK_KEY, value ? "1" : "0");
  }

  getGeminiSelectedModel(): string | undefined {
    return this.get(GEMINI_MODEL_KEY);
  }

  setGeminiSelectedModel(model: string | undefined): void {
    if (!model?.trim()) {
      this.db.prepare("DELETE FROM app_meta WHERE key=?").run(GEMINI_MODEL_KEY);
      return;
    }
    this.set(GEMINI_MODEL_KEY, model.trim());
  }

  getTikTokUniqueId(): string | undefined {
    return this.get(TIKTOK_UNIQUE_ID_KEY);
  }

  setTikTokUniqueId(id: string | undefined): void {
    if (!id?.trim()) {
      this.db.prepare("DELETE FROM app_meta WHERE key=?").run(TIKTOK_UNIQUE_ID_KEY);
      return;
    }
    this.set(TIKTOK_UNIQUE_ID_KEY, id.trim());
  }

  getFocusedAccountId(): string | undefined {
    return this.get(FOCUSED_ACCOUNT_KEY);
  }

  setFocusedAccountId(id: string | undefined): void {
    if (!id?.trim()) {
      this.db.prepare("DELETE FROM app_meta WHERE key=?").run(FOCUSED_ACCOUNT_KEY);
      return;
    }
    this.set(FOCUSED_ACCOUNT_KEY, id.trim());
  }
}

export class ProductRepository {
  constructor(private readonly db: Database.Database) {}

  list(): ProductDNA[] {
    return this.db.prepare("SELECT json FROM products ORDER BY updated_at DESC")
      .all()
      .map((row: any) => normalizeProduct(JSON.parse(row.json)));
  }

  save(product: ProductDNA): void {
    const normalized = normalizeProduct(product);
    this.db.prepare(`
      INSERT INTO products(id, json, updated_at)
      VALUES(?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET json=excluded.json, updated_at=excluded.updated_at
    `).run(normalized.id, JSON.stringify(normalized), normalized.updatedAt);
  }

  get(id: string): ProductDNA | undefined {
    const row = this.db.prepare("SELECT json FROM products WHERE id=?").get(id) as any;
    return row ? normalizeProduct(JSON.parse(row.json)) : undefined;
  }

  delete(id: string): boolean {
    const result = this.db.prepare("DELETE FROM products WHERE id=?").run(id);
    return result.changes > 0;
  }
}

export class LiveEventRepository {
  constructor(private readonly db: Database.Database) {}
  save(sessionId: string | null, event: LiveEvent): void {
    const sid = sessionId ?? event.sessionId ?? null;
    this.db.prepare(`
      INSERT OR IGNORE INTO live_events(id, session_id, account_id, sequence, type, source, timestamp, json)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      event.id,
      sid,
      event.accountId,
      event.sequence,
      event.type,
      event.source,
      event.timestamp,
      JSON.stringify(event)
    );
  }
}

export class ApprovalRepository {
  constructor(private readonly db: Database.Database) {}
  save(sessionId: string | null, item: ApprovalItem): void {
    const sid = sessionId ?? item.sessionId ?? null;
    this.db.prepare(`
      INSERT INTO approvals(id, session_id, account_id, status, created_at, resolved_at, json)
      VALUES(?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status=excluded.status,
        resolved_at=excluded.resolved_at,
        account_id=excluded.account_id,
        json=excluded.json
    `).run(
      item.id,
      sid,
      item.accountId ?? null,
      item.status,
      item.createdAt,
      item.resolvedAt ?? null,
      JSON.stringify(item)
    );
  }
}

/** Persist live session rows — runtime memory stays in-memory. */
export class LiveSessionRepository {
  constructor(private readonly db: Database.Database) {}

  /** Align DB row with in-memory session id created at live start. */
  startWithId(sessionId: string, automationMode: string, accountId?: string | null): void {
    this.db
      .prepare(
        `
      INSERT OR IGNORE INTO live_sessions(id, account_id, started_at, ended_at, automation_mode, final_state, status)
      VALUES(?, ?, ?, NULL, ?, NULL, 'RUNNING')
    `
      )
      .run(sessionId, accountId ?? null, new Date().toISOString(), automationMode);
  }

  end(sessionId: string, finalState: string): void {
    const status = statusFromFinalState(finalState);
    this.db
      .prepare(
        `
      UPDATE live_sessions
      SET ended_at = ?, final_state = ?, status = ?
      WHERE id = ? AND ended_at IS NULL
    `
      )
      .run(new Date().toISOString(), finalState, status, sessionId);
  }

  hasActiveSession(accountId: string): boolean {
    const row = this.db
      .prepare(
        `SELECT 1 AS ok FROM live_sessions WHERE account_id = ? AND ended_at IS NULL LIMIT 1`
      )
      .get(accountId) as { ok: number } | undefined;
    return Boolean(row?.ok);
  }

  /** Open sessions left by a crashed process (ended_at IS NULL). */
  listOpenSessions(): LiveSession[] {
    const rows = this.db
      .prepare(
        `
      SELECT id, account_id, started_at, ended_at, automation_mode, final_state, status
      FROM live_sessions
      WHERE ended_at IS NULL
      ORDER BY started_at ASC
    `
      )
      .all() as SessionRow[];
    return rows.map(mapSessionRow);
  }

  get(sessionId: string): LiveSession | undefined {
    const row = this.db
      .prepare(
        `
      SELECT id, account_id, started_at, ended_at, automation_mode, final_state, status
      FROM live_sessions WHERE id = ?
    `
      )
      .get(sessionId) as SessionRow | undefined;
    return row ? mapSessionRow(row) : undefined;
  }

  /**
   * Close every open session — used only by crash recovery on process startup.
   * Does not delete rows (history preserved).
   */
  abortAllOpen(endedAt: string, finalState: string): number {
    const status = statusFromFinalState(finalState);
    const result = this.db
      .prepare(
        `
      UPDATE live_sessions
      SET ended_at = ?, final_state = ?, status = ?
      WHERE ended_at IS NULL
    `
      )
      .run(endedAt, finalState, status);
    return result.changes;
  }
}

type SessionRow = {
  id: string;
  account_id: string | null;
  started_at: string;
  ended_at: string | null;
  automation_mode: string;
  final_state: string | null;
  status: string | null;
};

function mapSessionRow(row: SessionRow): LiveSession {
  return {
    id: row.id,
    accountId: row.account_id ?? "",
    startedAt: row.started_at,
    endedAt: row.ended_at ?? undefined,
    automationMode: row.automation_mode as AutomationMode,
    finalState: row.final_state ?? undefined,
    status: (row.status as LiveSession["status"]) ?? undefined
  };
}

function statusFromFinalState(finalState: string): string {
  if (finalState === "CRASH_RECOVERED") return "CRASH_RECOVERED";
  if (finalState === "ABORTED") return "ABORTED";
  return "ENDED";
}

type AccountRow = {
  id: string;
  username: string;
  display_name: string | null;
  label: string | null;
  profile_key: string;
  enabled: number;
  created_at: string;
  updated_at: string;
  last_connected_at: string | null;
};

function mapAccountRow(row: AccountRow): TikTokAccount {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name ?? undefined,
    label: row.label ?? undefined,
    profileKey: row.profile_key,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastConnectedAt: row.last_connected_at ?? undefined
  };
}

export class TikTokAccountRepository {
  constructor(private readonly db: Database.Database) {}

  list(): TikTokAccount[] {
    return (
      this.db
        .prepare(`SELECT * FROM tiktok_accounts ORDER BY created_at ASC`)
        .all() as AccountRow[]
    ).map(mapAccountRow);
  }

  get(id: string): TikTokAccount | undefined {
    const row = this.db.prepare(`SELECT * FROM tiktok_accounts WHERE id=?`).get(id) as
      | AccountRow
      | undefined;
    return row ? mapAccountRow(row) : undefined;
  }

  findByUsername(username: string): TikTokAccount | undefined {
    const normalized = normalizeTikTokUsername(username);
    if (!normalized) return undefined;
    const row = this.db
      .prepare(`SELECT * FROM tiktok_accounts WHERE username=?`)
      .get(normalized) as AccountRow | undefined;
    return row ? mapAccountRow(row) : undefined;
  }

  create(input: CreateTikTokAccountInput): TikTokAccount {
    const account = buildTikTokAccount(input);
    if (this.findByUsername(account.username)) {
      throw new Error("TIKTOK_USERNAME_EXISTS");
    }
    this.db
      .prepare(
        `
      INSERT INTO tiktok_accounts(
        id, username, display_name, label, profile_key, enabled,
        created_at, updated_at, last_connected_at
      ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, NULL)
    `
      )
      .run(
        account.id,
        account.username,
        account.displayName ?? null,
        account.label ?? null,
        account.profileKey,
        account.enabled ? 1 : 0,
        account.createdAt,
        account.updatedAt
      );
    return account;
  }

  update(
    id: string,
    patch: Partial<
      Pick<TikTokAccount, "username" | "displayName" | "label" | "enabled" | "lastConnectedAt">
    >
  ): TikTokAccount {
    const existing = this.get(id);
    if (!existing) throw new Error("TIKTOK_ACCOUNT_NOT_FOUND");

    const username =
      patch.username !== undefined
        ? normalizeTikTokUsername(patch.username)
        : existing.username;
    if (!username || username === "@") throw new Error("TIKTOK_USERNAME_REQUIRED");

    if (username !== existing.username) {
      const clash = this.findByUsername(username);
      if (clash && clash.id !== id) throw new Error("TIKTOK_USERNAME_EXISTS");
    }

    const updated: TikTokAccount = {
      ...existing,
      username,
      displayName:
        patch.displayName !== undefined
          ? patch.displayName.trim() || undefined
          : existing.displayName,
      label: patch.label !== undefined ? patch.label.trim() || undefined : existing.label,
      enabled: patch.enabled !== undefined ? patch.enabled : existing.enabled,
      lastConnectedAt:
        patch.lastConnectedAt !== undefined ? patch.lastConnectedAt : existing.lastConnectedAt,
      updatedAt: new Date().toISOString()
    };

    this.db
      .prepare(
        `
      UPDATE tiktok_accounts
      SET username=?, display_name=?, label=?, enabled=?, last_connected_at=?, updated_at=?
      WHERE id=?
    `
      )
      .run(
        updated.username,
        updated.displayName ?? null,
        updated.label ?? null,
        updated.enabled ? 1 : 0,
        updated.lastConnectedAt ?? null,
        updated.updatedAt,
        id
      );
    return updated;
  }

  /**
   * Delete account + its settings.
   * Refuses when the account has an active (ended_at IS NULL) live session.
   */
  delete(id: string): void {
    if (!this.get(id)) throw new Error("TIKTOK_ACCOUNT_NOT_FOUND");
    const active = this.db
      .prepare(
        `SELECT 1 AS ok FROM live_sessions WHERE account_id = ? AND ended_at IS NULL LIMIT 1`
      )
      .get(id) as { ok: number } | undefined;
    if (active) throw new Error("ACCOUNT_LIVE_ACTIVE");

    const tx = this.db.transaction(() => {
      this.db.prepare(`DELETE FROM account_live_settings WHERE account_id=?`).run(id);
      this.db.prepare(`DELETE FROM tiktok_accounts WHERE id=?`).run(id);
    });
    tx();
  }
}

type SettingsRow = {
  account_id: string;
  automation_mode: string;
  current_product_id: string | null;
  media_profile_id: string | null;
  enabled: number;
  updated_at: string;
};

function mapSettingsRow(row: SettingsRow): AccountLiveSettings {
  return {
    accountId: row.account_id,
    automationMode: row.automation_mode as AutomationMode,
    currentProductId: row.current_product_id ?? undefined,
    mediaProfileId: row.media_profile_id ?? undefined,
    enabled: row.enabled === 1,
    updatedAt: row.updated_at
  };
}

export class AccountLiveSettingsRepository {
  constructor(private readonly db: Database.Database) {}

  get(accountId: string): AccountLiveSettings | undefined {
    const row = this.db
      .prepare(`SELECT * FROM account_live_settings WHERE account_id=?`)
      .get(accountId) as SettingsRow | undefined;
    return row ? mapSettingsRow(row) : undefined;
  }

  /** Create default settings if missing (SUPERVISED_AUTO). */
  ensure(accountId: string): AccountLiveSettings {
    const existing = this.get(accountId);
    if (existing) return existing;
    return this.upsert({
      accountId,
      automationMode: DEFAULT_ACCOUNT_AUTOMATION_MODE,
      enabled: true
    });
  }

  upsert(
    input: Partial<AccountLiveSettings> & { accountId: string }
  ): AccountLiveSettings {
    const account = this.db
      .prepare(`SELECT 1 AS ok FROM tiktok_accounts WHERE id=?`)
      .get(input.accountId) as { ok: number } | undefined;
    if (!account) throw new Error("TIKTOK_ACCOUNT_NOT_FOUND");

    const prev = this.get(input.accountId);
    const next: AccountLiveSettings = {
      accountId: input.accountId,
      automationMode: input.automationMode ?? prev?.automationMode ?? DEFAULT_ACCOUNT_AUTOMATION_MODE,
      currentProductId:
        input.currentProductId !== undefined
          ? input.currentProductId || undefined
          : prev?.currentProductId,
      mediaProfileId:
        input.mediaProfileId !== undefined
          ? input.mediaProfileId || undefined
          : prev?.mediaProfileId,
      enabled: input.enabled !== undefined ? input.enabled : (prev?.enabled ?? true),
      updatedAt: new Date().toISOString()
    };

    this.db
      .prepare(
        `
      INSERT INTO account_live_settings(
        account_id, automation_mode, current_product_id, media_profile_id, enabled, updated_at
      ) VALUES(?, ?, ?, ?, ?, ?)
      ON CONFLICT(account_id) DO UPDATE SET
        automation_mode=excluded.automation_mode,
        current_product_id=excluded.current_product_id,
        media_profile_id=excluded.media_profile_id,
        enabled=excluded.enabled,
        updated_at=excluded.updated_at
    `
      )
      .run(
        next.accountId,
        next.automationMode,
        next.currentProductId ?? null,
        next.mediaProfileId ?? null,
        next.enabled ? 1 : 0,
        next.updatedAt
      );
    return next;
  }
}

/** Exported for self-checks that need schema version without opening Electron. */
export function readSchemaVersion(db: Database.Database): number {
  return getSchemaVersion(db);
}

/** Keep profileKey assert reachable from repository module for wiring checks. */
export function assertProfileKeySafe(key: string): void {
  assertSafeProfileKey(key);
}
