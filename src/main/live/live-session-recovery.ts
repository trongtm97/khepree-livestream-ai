import type { LiveSession } from "../../shared/live-types";
import { LIVE_SESSION_CRASH_RECOVERED } from "../../shared/live-types";
import type { LiveSessionRepository } from "../db/repositories";

export type SessionRecoveryReport = {
  recoveredCount: number;
  sessionIds: string[];
  accountIds: string[];
  recoveredAt: string;
  reason: typeof LIVE_SESSION_CRASH_RECOVERED;
};

/**
 * On process startup, any DB session with ended_at IS NULL cannot belong to
 * a live runtime in *this* process — close them as crash recovery.
 * V1 never auto-resumes livestreams.
 */
export class LiveSessionRecoveryService {
  constructor(private readonly sessions: LiveSessionRepository) {}

  recoverOnStartup(now = new Date()): SessionRecoveryReport {
    const open = this.sessions.listOpenSessions();
    const recoveredAt = now.toISOString();
    if (open.length === 0) {
      return {
        recoveredCount: 0,
        sessionIds: [],
        accountIds: [],
        recoveredAt,
        reason: LIVE_SESSION_CRASH_RECOVERED
      };
    }

    const sessionIds = open.map((s) => s.id);
    const accountIds = uniqueAccountIds(open);
    this.sessions.abortAllOpen(recoveredAt, LIVE_SESSION_CRASH_RECOVERED);

    return {
      recoveredCount: sessionIds.length,
      sessionIds,
      accountIds,
      recoveredAt,
      reason: LIVE_SESSION_CRASH_RECOVERED
    };
  }
}

function uniqueAccountIds(sessions: LiveSession[]): string[] {
  const seen = new Set<string>();
  for (const s of sessions) {
    if (s.accountId) seen.add(s.accountId);
  }
  return [...seen];
}
