import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export const SCHEMA_VERSION_KEY = "schema.version";
/** Current schema version — v3 adds live_sessions.status for crash recovery. */
export const CURRENT_SCHEMA_VERSION = 3;

export function openDatabase(userDataDir: string): Database.Database {
  const dataDir = path.join(userDataDir, "data");
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new Database(path.join(dataDir, "app.sqlite"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

export function getSchemaVersion(db: Database.Database): number {
  ensureAppMeta(db);
  const row = db.prepare("SELECT value FROM app_meta WHERE key=?").get(SCHEMA_VERSION_KEY) as
    | { value: string }
    | undefined;
  if (!row) return 0;
  const n = Number(row.value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function setSchemaVersion(db: Database.Database, version: number): void {
  db.prepare(`
    INSERT INTO app_meta(key, value)
    VALUES(?, ?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value
  `).run(SCHEMA_VERSION_KEY, String(version));
}

function ensureAppMeta(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

function tableHasColumn(db: Database.Database, table: string, column: string): boolean {
  // table name is internal-only; never pass user input
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.some((r) => r.name === column);
}

function migrateV1Foundation(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS live_sessions (
      id TEXT PRIMARY KEY,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      automation_mode TEXT NOT NULL,
      final_state TEXT
    );

    CREATE TABLE IF NOT EXISTS live_events (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      sequence INTEGER NOT NULL,
      type TEXT NOT NULL,
      source TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      json TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_live_events_sequence
      ON live_events(sequence);

    CREATE TABLE IF NOT EXISTS approvals (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      resolved_at TEXT,
      json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS secrets (
      key TEXT PRIMARY KEY,
      encrypted_value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

/**
 * Multi-live domain: TikTokAccount + AccountLiveSettings + session/event provenance.
 * Additive only — never drop existing product/session/event rows.
 */
function migrateV2MultiLive(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tiktok_accounts (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      display_name TEXT,
      label TEXT,
      profile_key TEXT NOT NULL UNIQUE,
      enabled INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_connected_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_tiktok_accounts_username
      ON tiktok_accounts(username);

    CREATE TABLE IF NOT EXISTS account_live_settings (
      account_id TEXT PRIMARY KEY,
      automation_mode TEXT NOT NULL,
      current_product_id TEXT,
      media_profile_id TEXT,
      enabled INTEGER NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (account_id) REFERENCES tiktok_accounts(id)
    );
  `);

  if (!tableHasColumn(db, "live_sessions", "account_id")) {
    db.exec(`ALTER TABLE live_sessions ADD COLUMN account_id TEXT`);
  }
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_live_sessions_account_active
      ON live_sessions(account_id, ended_at);
  `);

  if (!tableHasColumn(db, "live_events", "account_id")) {
    db.exec(`ALTER TABLE live_events ADD COLUMN account_id TEXT`);
  }
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_live_events_account_ts
      ON live_events(account_id, timestamp);
    CREATE INDEX IF NOT EXISTS idx_live_events_session_seq
      ON live_events(session_id, sequence);
  `);

  if (!tableHasColumn(db, "approvals", "account_id")) {
    db.exec(`ALTER TABLE approvals ADD COLUMN account_id TEXT`);
  }
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_approvals_account
      ON approvals(account_id);
  `);
}

/**
 * Live session status column for crash recovery queries.
 * Additive — never drop historical session rows.
 */
function migrateV3LiveSessionStatus(db: Database.Database): void {
  if (!tableHasColumn(db, "live_sessions", "status")) {
    db.exec(`ALTER TABLE live_sessions ADD COLUMN status TEXT`);
  }
  // Backfill: open rows → RUNNING; closed rows → ENDED (preserve explicit final_state markers).
  db.exec(`
    UPDATE live_sessions
    SET status = CASE
      WHEN ended_at IS NULL THEN 'RUNNING'
      WHEN final_state IN ('CRASH_RECOVERED', 'ABORTED') THEN final_state
      ELSE 'ENDED'
    END
    WHERE status IS NULL OR status = '';
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_live_sessions_status
      ON live_sessions(status);
  `);
}

/**
 * Versioned, additive migrations.
 * Legacy DBs without schema.version start at 0; v1 CREATE IF NOT EXISTS preserves rows.
 */
export function migrate(db: Database.Database): void {
  ensureAppMeta(db);

  let version = getSchemaVersion(db);

  if (version < 1) {
    migrateV1Foundation(db);
    setSchemaVersion(db, 1);
    version = 1;
  }

  if (version < 2) {
    migrateV2MultiLive(db);
    setSchemaVersion(db, 2);
    version = 2;
  }

  if (version < 3) {
    migrateV3LiveSessionStatus(db);
    setSchemaVersion(db, 3);
  }
}
