import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export function openDatabase(userDataDir: string): Database.Database {
  const dataDir = path.join(userDataDir, "data");
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new Database(path.join(dataDir, "app.sqlite"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

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
