import { useEffect, useState } from "react";
import { Activity, History, MessageSquareText, Radio, RefreshCw, Volume2 } from "lucide-react";
import type { ApprovalItem } from "../../shared/live-types";
import type { LiveSessionSummary, SessionTotals } from "../../shared/session-history";
import { useAppShell } from "../app/AppShellContext";
import { labelAutomationMode, labelLiveState } from "../i18n";
import { EmptyState } from "../components/common/EmptyState";
import { MetricCard } from "../components/common/MetricCard";

function formatDuration(seconds: number, locale: "vi" | "en"): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return locale === "vi" ? `${h} giờ ${m} phút` : `${h}h ${m}m`;
  if (m > 0) return locale === "vi" ? `${m} phút ${s} giây` : `${m}m ${s}s`;
  return locale === "vi" ? `${s} giây` : `${s}s`;
}

function formatWhen(iso: string, locale: "vi" | "en"): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(locale === "vi" ? "vi-VN" : "en-US");
}

/**
 * Post-stream review.
 *
 * Every session, event, and approval was already persisted — this page is what
 * reads it back so an operator can see what the AI actually did on air.
 */
export function HistoryPage() {
  const { t, locale } = useAppShell();
  const [sessions, setSessions] = useState<LiveSessionSummary[]>([]);
  const [totals, setTotals] = useState<SessionTotals>();
  const [selected, setSelected] = useState<string>();
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const load = async () => {
    setLoading(true);
    setError(undefined);
    try {
      const [rows, agg] = await Promise.all([
        window.khepreeLivestreamAI.listSessions(20),
        window.khepreeLivestreamAI.getSessionTotals()
      ]);
      setSessions(rows);
      setTotals(agg);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!selected) {
      setApprovals([]);
      return;
    }
    let cancelled = false;
    void window.khepreeLivestreamAI
      .listSessionApprovals(selected, 30)
      .then((rows) => {
        if (!cancelled) setApprovals(rows);
      })
      .catch(() => {
        if (!cancelled) setApprovals([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  return (
    <section className="historyPage">
      <div className="panel">
        <div className="panelHead">
          <div>
            <h2>{t("history.title")}</h2>
            <p>{t("history.subtitle")}</p>
          </div>
          <History />
        </div>

        <section className="metricGrid" style={{ marginTop: 12 }}>
          <MetricCard
            icon={<Radio />}
            label={t("history.metric.sessions")}
            value={String(totals?.sessions ?? 0)}
            tone="neutral"
          />
          <MetricCard
            icon={<Activity />}
            label={t("history.metric.events")}
            value={String(totals?.events ?? 0)}
            tone="neutral"
          />
          <MetricCard
            icon={<MessageSquareText />}
            label={t("history.metric.approvals")}
            value={String(totals?.approvals ?? 0)}
            tone="amber"
          />
          <MetricCard
            icon={<Volume2 />}
            label={t("history.metric.spoken")}
            value={String(totals?.executed ?? 0)}
            tone="green"
          />
        </section>

        <button
          type="button"
          className="ghost"
          style={{ marginTop: 14 }}
          disabled={loading}
          onClick={() => void load()}
        >
          <RefreshCw size={15} /> {t("history.refresh")}
        </button>
      </div>

      <div className="panel" style={{ marginTop: 14 }}>
        <h3>{t("history.sessionList")}</h3>
        {error ? <p className="startWarnNote">{error}</p> : null}

        {!loading && sessions.length === 0 ? (
          <EmptyState text={t("history.empty")} />
        ) : null}

        {sessions.length > 0 ? (
          <div className="tableWrap">
            <table className="historyTable">
              <thead>
                <tr>
                  <th>{t("history.col.started")}</th>
                  <th>{t("history.col.duration")}</th>
                  <th>{t("history.col.mode")}</th>
                  <th>{t("history.col.comments")}</th>
                  <th>{t("history.col.orders")}</th>
                  <th>{t("history.col.spoken")}</th>
                  <th>{t("history.col.rejected")}</th>
                  <th>{t("history.col.endState")}</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr
                    key={session.id}
                    onClick={() => setSelected(session.id === selected ? undefined : session.id)}
                    className={session.id === selected ? "selected" : undefined}
                  >
                    <td>{formatWhen(session.startedAt, locale)}</td>
                    <td>{formatDuration(session.durationSec, locale)}</td>
                    <td>
                      {labelAutomationMode(t, session.automationMode as never)}
                    </td>
                    <td>{session.commentCount}</td>
                    <td>{session.orderCount}</td>
                    <td>{session.executedCount}</td>
                    <td>{session.rejectedCount}</td>
                    <td>
                      {session.finalState ? labelLiveState(t, session.finalState) : t("history.running")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <p className="importHint">{t("history.selectHint")}</p>
      </div>

      {selected ? (
        <div className="panel" style={{ marginTop: 14 }}>
          <h3>{t("history.approvalsTitle")}</h3>
          {approvals.length === 0 ? (
            <EmptyState text={t("history.noApprovals")} />
          ) : (
            <ul className="historyApprovalList">
              {approvals.map((item) => (
                <li key={item.id}>
                  <div className="historyApprovalHead">
                    <strong>{item.proposal.kind}</strong>
                    <span>{item.status}</span>
                    <span>
                      {Math.round(item.proposal.confidence * 100)}
                      {t("history.percent")}
                    </span>
                  </div>
                  <p>{item.proposal.speech || item.proposal.reason}</p>
                  {item.proposal.riskTags.length > 0 ? (
                    <p className="historyRisk">
                      {t("history.risk")}: {item.proposal.riskTags.join(", ")}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
