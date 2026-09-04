/** Renderer-safe summary of a past livestream session. */

export type LiveSessionSummary = {
  id: string;
  startedAt: string;
  endedAt?: string;
  automationMode: string;
  finalState?: string;
  /** 0 while the session is still running. */
  durationSec: number;
  eventCount: number;
  commentCount: number;
  orderCount: number;
  approvalCount: number;
  executedCount: number;
  rejectedCount: number;
  expiredCount: number;
  /** 0–1: share of handled approvals that ran without an explicit click. */
  autonomousShare: number;
};

export type SessionTotals = {
  sessions: number;
  events: number;
  approvals: number;
  executed: number;
};

export function formatDurationVi(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h} giờ ${m} phút`;
  if (m > 0) return `${m} phút ${s} giây`;
  return `${s} giây`;
}

export function formatDurationEn(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
