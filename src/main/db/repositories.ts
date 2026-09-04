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
import type { ApprovalItem, LiveEvent, ProductDNA } from "../../shared/live-types";
import { normalizeProduct } from "../../shared/product-dna";

const UI_LOCALE_KEY = "ui.locale";
const ONBOARDING_COMPLETED_KEY = "onboarding.completed";
const ONBOARDING_STEP_KEY = "onboarding.currentStep";
const CURRENT_PRODUCT_KEY = "products.currentId";
const LLM_PREFERRED_KEY = "llm.preferredProvider";
const LLM_DEMO_ACK_KEY = "llm.demoAcknowledged";
const GEMINI_MODEL_KEY = "gemini.selectedModel";
const TIKTOK_UNIQUE_ID_KEY = "tiktok.uniqueId";

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
    this.db.prepare(`
      INSERT OR IGNORE INTO live_events(id, session_id, sequence, type, source, timestamp, json)
      VALUES(?, ?, ?, ?, ?, ?, ?)
    `).run(
      event.id, sessionId, event.sequence, event.type,
      event.source, event.timestamp, JSON.stringify(event)
    );
  }
}

export class ApprovalRepository {
  constructor(private readonly db: Database.Database) {}
  save(sessionId: string | null, item: ApprovalItem): void {
    this.db.prepare(`
      INSERT INTO approvals(id, session_id, status, created_at, resolved_at, json)
      VALUES(?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status=excluded.status,
        resolved_at=excluded.resolved_at,
        json=excluded.json
    `).run(
      item.id, sessionId, item.status, item.createdAt,
      item.resolvedAt ?? null, JSON.stringify(item)
    );
  }
}

/** Persist live session rows — runtime memory stays in-memory. */
export class LiveSessionRepository {
  constructor(private readonly db: Database.Database) {}

  /** Align DB row with in-memory session id created at live start. */
  startWithId(sessionId: string, automationMode: string): void {
    this.db.prepare(`
      INSERT OR IGNORE INTO live_sessions(id, started_at, ended_at, automation_mode, final_state)
      VALUES(?, ?, NULL, ?, NULL)
    `).run(sessionId, new Date().toISOString(), automationMode);
  }

  end(sessionId: string, finalState: string): void {
    this.db.prepare(`
      UPDATE live_sessions
      SET ended_at = ?, final_state = ?
      WHERE id = ? AND ended_at IS NULL
    `).run(new Date().toISOString(), finalState, sessionId);
  }
}
