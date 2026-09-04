import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import {
  ApprovalRepository,
  LiveEventRepository,
  LiveSessionRepository,
  SessionHistoryRepository
} from "../src/main/db/repositories";
import type { ApprovalItem, LiveEvent } from "../src/shared/live-types";

let db: Database.Database;
let sessions: LiveSessionRepository;
let events: LiveEventRepository;
let approvals: ApprovalRepository;
let history: SessionHistoryRepository;

beforeEach(() => {
  db = new Database(":memory:");
  // Same schema the app migrates to.
  db.exec(`
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
    CREATE TABLE IF NOT EXISTS approvals (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      resolved_at TEXT,
      json TEXT NOT NULL
    );
  `);
  sessions = new LiveSessionRepository(db);
  events = new LiveEventRepository(db);
  approvals = new ApprovalRepository(db);
  history = new SessionHistoryRepository(db);
});

afterEach(() => {
  db.close();
});

function event(id: string, type: LiveEvent["type"], sequence: number): LiveEvent {
  return {
    id,
    sequence,
    type,
    source: "tiktoklive",
    timestamp: new Date().toISOString()
  };
}

function approval(id: string, status: ApprovalItem["status"], speech: string): ApprovalItem {
  return {
    id,
    proposal: {
      id: `p-${id}`,
      createdAt: new Date().toISOString(),
      kind: "SPEAK",
      speech,
      confidence: 0.95,
      reason: "test",
      riskTags: []
    },
    status,
    createdAt: new Date().toISOString()
  };
}

describe("SessionHistoryRepository", () => {
  it("returns an empty history when nothing has been recorded", () => {
    expect(history.list()).toEqual([]);
    expect(history.totals()).toEqual({ sessions: 0, events: 0, approvals: 0, executed: 0 });
  });

  it("summarizes a finished session", () => {
    const started = new Date("2026-01-01T10:00:00Z");
    const ended = new Date("2026-01-01T11:30:00Z");
    sessions.startWithId("s1", "SUPERVISED_AUTO");
    db.prepare("UPDATE live_sessions SET started_at=?, ended_at=?, final_state=? WHERE id=?").run(
      started.toISOString(),
      ended.toISOString(),
      "IDLE",
      "s1"
    );

    ["COMMENT", "COMMENT", "COMMENT", "ORDER_ACTIVITY", "LIKE"].forEach((type, i) => {
      events.save("s1", event(`e${i}`, type as LiveEvent["type"], i + 1));
    });
    approvals.save("s1", approval("a1", "EXECUTED", "câu một"));
    approvals.save("s1", approval("a2", "EXECUTED", "câu hai"));
    approvals.save("s1", approval("a3", "REJECTED", "câu ba"));

    const [row] = history.list();
    expect(row).toBeDefined();
    expect(row!.durationSec).toBe(90 * 60);
    expect(row!.commentCount).toBe(3);
    expect(row!.orderCount).toBe(1);
    expect(row!.eventCount).toBe(5);
    expect(row!.executedCount).toBe(2);
    expect(row!.rejectedCount).toBe(1);
    expect(row!.finalState).toBe("IDLE");
    expect(row!.automationMode).toBe("SUPERVISED_AUTO");
    // 2 of 3 handled replies ran without an explicit click.
    expect(row!.autonomousShare).toBeCloseTo(2 / 3);
  });

  it("reports a running session with zero duration", () => {
    sessions.startWithId("live-now", "SUPERVISED_AUTO");
    const [row] = history.list();
    expect(row!.durationSec).toBe(0);
    expect(row!.endedAt).toBeUndefined();
    expect(row!.autonomousShare).toBe(0);
  });

  it("orders sessions newest first", () => {
    sessions.startWithId("old", "MANUAL_ASSIST");
    db.prepare("UPDATE live_sessions SET started_at=? WHERE id=?").run(
      "2020-01-01T00:00:00Z",
      "old"
    );
    sessions.startWithId("new", "SUPERVISED_AUTO");
    db.prepare("UPDATE live_sessions SET started_at=? WHERE id=?").run(
      "2026-01-01T00:00:00Z",
      "new"
    );

    expect(history.list().map((s) => s.id)).toEqual(["new", "old"]);
  });

  it("honours the limit", () => {
    for (let i = 0; i < 25; i += 1) sessions.startWithId(`s${i}`, "SUPERVISED_AUTO");
    expect(history.list(5)).toHaveLength(5);
  });

  it("aggregates totals across sessions", () => {
    sessions.startWithId("s1", "SUPERVISED_AUTO");
    sessions.startWithId("s2", "SUPERVISED_AUTO");
    events.save("s1", event("e1", "COMMENT", 1));
    events.save("s2", event("e2", "COMMENT", 2));
    approvals.save("s1", approval("a1", "EXECUTED", "nói"));
    approvals.save("s2", approval("a2", "REJECTED", "không nói"));

    expect(history.totals()).toEqual({ sessions: 2, events: 2, approvals: 2, executed: 1 });
  });

  it("reads back what the AI actually said", () => {
    sessions.startWithId("s1", "SUPERVISED_AUTO");
    approvals.save("s1", approval("a1", "EXECUTED", "Cảm ơn bạn đã mua"));
    approvals.save("s1", approval("a2", "EXECUTED", "Còn size M nhé"));

    const rows = history.listApprovals("s1");
    expect(rows).toHaveLength(2);
    const speeches = rows.map((r) => r.proposal.speech);
    expect(speeches).toContain("Cảm ơn bạn đã mua");
    expect(speeches).toContain("Còn size M nhé");
  });

  it("returns [] for an unknown session", () => {
    expect(history.listApprovals("nope")).toEqual([]);
  });

  it("survives a corrupt approval row", () => {
    sessions.startWithId("s1", "SUPERVISED_AUTO");
    db.prepare(
      "INSERT INTO approvals(id, session_id, status, created_at, resolved_at, json) VALUES(?,?,?,?,?,?)"
    ).run("bad", "s1", "EXECUTED", new Date().toISOString(), null, "{not json");
    approvals.save("s1", approval("good", "EXECUTED", "câu tốt"));

    const rows = history.listApprovals("s1");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.proposal.speech).toBe("câu tốt");
  });

  it("does not leak events between sessions", () => {
    sessions.startWithId("s1", "SUPERVISED_AUTO");
    sessions.startWithId("s2", "SUPERVISED_AUTO");
    events.save("s1", event("e1", "COMMENT", 1));
    events.save("s1", event("e2", "COMMENT", 2));
    events.save("s2", event("e3", "COMMENT", 3));

    const byId = new Map(history.list().map((s) => [s.id, s]));
    expect(byId.get("s1")?.commentCount).toBe(2);
    expect(byId.get("s2")?.commentCount).toBe(1);
  });
});
