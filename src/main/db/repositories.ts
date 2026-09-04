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
import type { LiveSessionSummary, SessionTotals } from "../../shared/session-history";
import { normalizeProduct } from "../../shared/product-dna";

const UI_LOCALE_KEY = "ui.locale";
const ONBOARDING_COMPLETED_KEY = "onboarding.completed";
const ONBOARDING_STEP_KEY = "onboarding.currentStep";
const CURRENT_PRODUCT_KEY = "products.currentId";
const LLM_PREFERRED_KEY = "llm.preferredProvider";
const LLM_DEMO_ACK_KEY = "llm.demoAcknowledged";
const GEMINI_MODEL_KEY = "gemini.selectedModel";
const TIKTOK_UNIQUE_ID_KEY = "tiktok.uniqueId";
const MEDIA_VOICE_KEY = "media.voice";
const MEDIA_VOICE_ENABLED_KEY = "media.voiceEnabled";

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

  /** Preferred OS voice name (substring match). Undefined = system default. */
  getMediaVoice(): string | undefined {
    return this.get(MEDIA_VOICE_KEY);
  }

  setMediaVoice(voice: string | undefined): void {
    if (!voice?.trim()) {
      this.db.prepare("DELETE FROM app_meta WHERE key=?").run(MEDIA_VOICE_KEY);
      return;
    }
    this.set(MEDIA_VOICE_KEY, voice.trim());
  }

  /** Operator kill-switch for AI voice. Defaults to enabled. */
  getMediaVoiceEnabled(): boolean {
    return this.get(MEDIA_VOICE_ENABLED_KEY) !== "0";
  }

  setMediaVoiceEnabled(enabled: boolean): void {
    this.set(MEDIA_VOICE_ENABLED_KEY, enabled ? "1" : "0");
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

/**
 * Read side of the livestream history.
 *
 * The session/event/approval tables were written but never read back, so an
 * operator could not review what the AI did after a stream. These summaries
 * power the History page.
 */
export class SessionHistoryRepository {
  constructor(private readonly db: Database.Database) {}

  list(limit = 20): LiveSessionSummary[] {
    const rows = this.db
      .prepare(
        `SELECT s.id, s.started_at, s.ended_at, s.automation_mode, s.final_state,
                (SELECT COUNT(*) FROM live_events e WHERE e.session_id = s.id) AS event_count,
                (SELECT COUNT(*) FROM live_events e WHERE e.session_id = s.id AND e.type = 'COMMENT') AS comment_count,
                (SELECT COUNT(*) FROM live_events e WHERE e.session_id = s.id AND e.type = 'ORDER_ACTIVITY') AS order_count,
                (SELECT COUNT(*) FROM approvals a WHERE a.session_id = s.id) AS approval_count,
                (SELECT COUNT(*) FROM approvals a WHERE a.session_id = s.id AND a.status = 'EXECUTED') AS executed_count,
                (SELECT COUNT(*) FROM approvals a WHERE a.session_id = s.id AND a.status = 'REJECTED') AS rejected_count,
                (SELECT COUNT(*) FROM approvals a WHERE a.session_id = s.id AND a.status = 'EXPIRED') AS expired_count
           FROM live_sessions s
          ORDER BY s.started_at DESC
          LIMIT ?`
      )
      .all(Math.max(1, Math.min(limit, 200))) as Array<Record<string, number | string | null>>;

    return rows.map((row) => {
      const startedAt = String(row.started_at);
      const endedAt = row.ended_at ? String(row.ended_at) : undefined;
      const started = Date.parse(startedAt);
      const ended = endedAt ? Date.parse(endedAt) : NaN;
      const durationSec =
        Number.isFinite(started) && Number.isFinite(ended)
          ? Math.max(0, Math.round((ended - started) / 1000))
          : 0;

      const executed = Number(row.executed_count ?? 0);
      const rejected = Number(row.rejected_count ?? 0);
      const handled = executed + rejected;

      return {
        id: String(row.id),
        startedAt,
        endedAt,
        automationMode: String(row.automation_mode),
        finalState: row.final_state ? String(row.final_state) : undefined,
        durationSec,
        eventCount: Number(row.event_count ?? 0),
        commentCount: Number(row.comment_count ?? 0),
        orderCount: Number(row.order_count ?? 0),
        approvalCount: Number(row.approval_count ?? 0),
        executedCount: executed,
        rejectedCount: rejected,
        expiredCount: Number(row.expired_count ?? 0),
        autonomousShare: handled > 0 ? executed / handled : 0
      };
    });
  }

  /** Most recent approvals for one session — what the AI said and why. */
  listApprovals(sessionId: string, limit = 50): ApprovalItem[] {
    const rows = this.db
      .prepare(
        `SELECT json FROM approvals
          WHERE session_id = ?
          ORDER BY created_at DESC
          LIMIT ?`
      )
      .all(sessionId, Math.max(1, Math.min(limit, 500))) as Array<{ json: string }>;

    return rows.map((row) => {
      try {
        return JSON.parse(row.json) as ApprovalItem;
      } catch {
        return null;
      }
    }).filter((item): item is ApprovalItem => Boolean(item));
  }

  /** Aggregate across every recorded session — the Overview "how did it go". */
  totals(): SessionTotals {
    const row = this.db
      .prepare(
        `SELECT (SELECT COUNT(*) FROM live_sessions) AS sessions,
                (SELECT COUNT(*) FROM live_events) AS events,
                (SELECT COUNT(*) FROM approvals) AS approvals,
                (SELECT COUNT(*) FROM approvals WHERE status = 'EXECUTED') AS executed`
      )
      .get() as Record<string, number>;
    return {
      sessions: Number(row.sessions ?? 0),
      events: Number(row.events ?? 0),
      approvals: Number(row.approvals ?? 0),
      executed: Number(row.executed ?? 0)
    };
  }
}
