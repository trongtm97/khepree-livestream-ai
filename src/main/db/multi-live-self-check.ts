/**
 * Multi-live domain self-check (PROMPT MULTI-LIVE 01).
 *
 * Proves:
 * 1. create 3 accounts with distinct usernames
 * 2. per-account settings isolation (product A ≠ product B)
 * 3. migration preserves existing products
 * 4. reload DB still reads accounts correctly
 * 5. delete refuses while account is LIVE
 *
 * Run: npx --yes tsx src/main/db/multi-live-self-check.ts
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { CURRENT_SCHEMA_VERSION, getSchemaVersion, openDatabase } from "./connection";
import {
  AccountLiveSettingsRepository,
  LiveSessionRepository,
  ProductRepository,
  TikTokAccountRepository
} from "./repositories";
import { assertTikTokAccountHelpers } from "../../shared/tiktok-account";
import type { ProductDNA } from "../../shared/live-types";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function tempUserData(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "khepree-multi-live-"));
}

function sampleProduct(id: string, title: string): ProductDNA {
  return {
    id,
    title,
    facts: [],
    benefits: [],
    sizes: [],
    colors: [],
    variants: [],
    faq: [],
    allowedClaims: [],
    forbiddenClaims: [],
    updatedAt: new Date().toISOString()
  };
}

export function assertMultiLiveDomain(): void {
  assertTikTokAccountHelpers();

  // --- legacy DB without schema.version: products survive v2 migration ---
  {
    const legacyDir = tempUserData();
    try {
      const dataDir = path.join(legacyDir, "data");
      fs.mkdirSync(dataDir, { recursive: true });
      const legacy = new Database(path.join(dataDir, "app.sqlite"));
      legacy.exec(`
        CREATE TABLE app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE products (id TEXT PRIMARY KEY, json TEXT NOT NULL, updated_at TEXT NOT NULL);
        CREATE TABLE live_sessions (
          id TEXT PRIMARY KEY, started_at TEXT NOT NULL, ended_at TEXT,
          automation_mode TEXT NOT NULL, final_state TEXT
        );
        CREATE TABLE live_events (
          id TEXT PRIMARY KEY, session_id TEXT, sequence INTEGER NOT NULL,
          type TEXT NOT NULL, source TEXT NOT NULL, timestamp TEXT NOT NULL, json TEXT NOT NULL
        );
        CREATE TABLE approvals (
          id TEXT PRIMARY KEY, session_id TEXT, status TEXT NOT NULL,
          created_at TEXT NOT NULL, resolved_at TEXT, json TEXT NOT NULL
        );
        CREATE TABLE secrets (
          key TEXT PRIMARY KEY, encrypted_value TEXT NOT NULL, updated_at TEXT NOT NULL
        );
      `);
      const keep = sampleProduct("prod_legacy", "Legacy Product");
      legacy
        .prepare(`INSERT INTO products(id, json, updated_at) VALUES(?, ?, ?)`)
        .run(keep.id, JSON.stringify(keep), keep.updatedAt);
      legacy.close();

      const upgraded = openDatabase(legacyDir);
      assert(getSchemaVersion(upgraded) === CURRENT_SCHEMA_VERSION, "legacy upgrade version");
      const productsLegacy = new ProductRepository(upgraded);
      assert(productsLegacy.get("prod_legacy")?.title === "Legacy Product", "legacy product lost");
      const table = upgraded
        .prepare(
          `SELECT 1 AS ok FROM sqlite_master WHERE type='table' AND name='tiktok_accounts'`
        )
        .get() as { ok: number } | undefined;
      assert(table?.ok, "tiktok_accounts missing after upgrade");
      upgraded.close();
    } finally {
      fs.rmSync(legacyDir, { recursive: true, force: true });
    }
  }

  const userData = tempUserData();
  try {
    // --- migration preserves products ---
    const db1 = openDatabase(userData);
    assert(getSchemaVersion(db1) === CURRENT_SCHEMA_VERSION, "schema version must be current");

    const products = new ProductRepository(db1);
    products.save(sampleProduct("prod_keep", "Keep Me"));
    products.save(sampleProduct("prod_a", "Product A"));
    products.save(sampleProduct("prod_b", "Product B"));
    assert(products.list().length === 3, "seed products missing");

    const accounts = new TikTokAccountRepository(db1);
    const settings = new AccountLiveSettingsRepository(db1);
    const sessions = new LiveSessionRepository(db1);

    const a = accounts.create({ username: "shop_a", label: "Shop A" });
    const b = accounts.create({ username: "@shop_b", displayName: "Shop B" });
    const c = accounts.create({ username: "shop_c" });

    assert(accounts.list().length === 3, "expected 3 accounts");
    assert(a.username === "@shop_a" && b.username === "@shop_b" && c.username === "@shop_c", "username normalize");
    assert(a.profileKey !== b.profileKey && b.profileKey !== c.profileKey, "profileKey must be unique");
    assert(!a.profileKey.includes("@") && !a.profileKey.includes("shop_a"), "profileKey must not be raw username");

    settings.ensure(a.id);
    settings.ensure(b.id);
    settings.ensure(c.id);

    settings.upsert({ accountId: a.id, currentProductId: "prod_a", automationMode: "ASSISTED" });
    settings.upsert({ accountId: b.id, currentProductId: "prod_b", automationMode: "SUPERVISED_AUTO" });

    const sa = settings.get(a.id)!;
    const sb = settings.get(b.id)!;
    assert(sa.currentProductId === "prod_a", "account A product wrong");
    assert(sb.currentProductId === "prod_b", "account B product wrong");
    assert(sa.automationMode === "ASSISTED", "account A mode wrong");
    assert(sb.automationMode === "SUPERVISED_AUTO", "account B mode wrong");

    // Changing A must not touch B
    settings.upsert({ accountId: a.id, currentProductId: "prod_keep" });
    assert(settings.get(a.id)!.currentProductId === "prod_keep", "A product update failed");
    assert(settings.get(b.id)!.currentProductId === "prod_b", "B product must stay isolated");

    // delete while LIVE must refuse
    sessions.startWithId("sess_live", "SUPERVISED_AUTO", a.id);
    let refused = false;
    try {
      accounts.delete(a.id);
    } catch (e) {
      refused = e instanceof Error && e.message === "ACCOUNT_LIVE_ACTIVE";
    }
    assert(refused, "delete must refuse while LIVE");
    sessions.end("sess_live", "IDLE");
    accounts.delete(a.id);
    assert(!accounts.get(a.id), "account A should be deleted after session end");
    assert(!settings.get(a.id), "settings should cascade-delete with account");

    // products still intact after account ops
    assert(products.get("prod_keep")?.title === "Keep Me", "products must survive account ops");

    db1.close();

    // --- reload ---
    const db2 = openDatabase(userData);
    const accounts2 = new TikTokAccountRepository(db2);
    const settings2 = new AccountLiveSettingsRepository(db2);
    const products2 = new ProductRepository(db2);

    assert(getSchemaVersion(db2) === CURRENT_SCHEMA_VERSION, "reload schema version");
    assert(accounts2.list().length === 2, "reload account count");
    assert(accounts2.findByUsername("shop_b")?.id === b.id, "findByUsername after reload");
    assert(settings2.get(b.id)?.currentProductId === "prod_b", "settings survive reload");
    assert(products2.list().length === 3, "products survive migration+reload");
    assert(products2.get("prod_keep")?.id === "prod_keep", "product id preserved");

    db2.close();
  } finally {
    fs.rmSync(userData, { recursive: true, force: true });
  }
}

const entry = process.argv[1] ?? "";
if (/multi-live-self-check\.(ts|js)$/.test(entry.replace(/\\/g, "/"))) {
  assertMultiLiveDomain();
  console.log("multi-live domain self-check PASS");
}
