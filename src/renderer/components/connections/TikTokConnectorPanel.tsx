import { useEffect, useState } from "react";
import { Radio } from "lucide-react";
import type { TikTokConnectionPhase, TikTokPublicState } from "../../../shared/tiktok-contracts";
import type { AppSnapshot } from "../../../shared/ipc";
import { requireFocusedAccountId } from "../../app/accountId";
import { useAppShell } from "../../app/AppShellContext";
import type { MessageKey } from "../../i18n/types";

const PHASE_LABEL: Record<TikTokConnectionPhase, MessageKey> = {
  DISCONNECTED: "tiktok.phase.DISCONNECTED",
  CONNECTING: "tiktok.phase.CONNECTING",
  CONNECTED: "tiktok.phase.CONNECTED",
  RECONNECTING: "tiktok.phase.RECONNECTING",
  CONNECTOR_ERROR: "tiktok.phase.CONNECTOR_ERROR",
  DEPENDENCY_MISSING: "tiktok.phase.DEPENDENCY_MISSING"
};

function formatDuration(connectedAt: string | undefined, nowMs: number): string {
  if (!connectedAt) return "—";
  const start = Date.parse(connectedAt);
  if (!Number.isFinite(start)) return "—";
  const sec = Math.max(0, Math.floor((nowMs - start) / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function TikTokConnectorPanel({
  snapshot,
  tiktok
}: {
  snapshot: AppSnapshot;
  tiktok: TikTokPublicState;
}) {
  const { t, run, refresh, notify } = useAppShell();
  const accountId = snapshot.focusedAccountId;
  const live = snapshot.lives.find((l) => l.accountId === accountId);
  const username = (live?.username ?? tiktok.uniqueId ?? "").replace(/^@/, "");
  const [nowMs, setNowMs] = useState(Date.now());
  const busy = tiktok.phase === "CONNECTING" || tiktok.phase === "RECONNECTING";

  useEffect(() => {
    if (!tiktok.connectedAt) return;
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [tiktok.connectedAt]);

  const connect = () =>
    run(async () => {
      const id = requireFocusedAccountId(snapshot);
      await window.khepreeLivestreamAI.connectTikTok(id);
      notify({ tone: "success", title: t("tiktok.toast.connected") });
      await refresh();
    });

  const disconnect = () =>
    run(async () => {
      const id = requireFocusedAccountId(snapshot);
      await window.khepreeLivestreamAI.disconnectTikTok(id);
      notify({ tone: "info", title: t("tiktok.toast.disconnected") });
      await refresh();
    });

  return (
    <div className="panel">
      <div className="panelHead">
        <div>
          <h2>{t("setup.tiktokTitle")}</h2>
          <p>{t("setup.tiktokSubtitle")}</p>
        </div>
        <Radio />
      </div>

      <div className={`statusBox tiktokStatusBox phase-${tiktok.phase}`}>
        <strong>{t(PHASE_LABEL[tiktok.phase])}</strong>
        <span>{tiktok.message || t("tiktok.noMessage")}</span>
      </div>

      <label className="tiktokUsernameLabel">
        {t("tiktok.username")}
        <div className="tiktokUsernameRow">
          <span className="tiktokAt">@</span>
          <input
            value={username}
            readOnly
            placeholder={t("tiktok.usernamePlaceholder")}
            disabled={busy || tiktok.connected || !accountId}
            autoComplete="off"
            spellCheck={false}
            title="Username is bound to the focused TikTok account"
          />
        </div>
      </label>

      {!accountId ? (
        <p className="tiktokHint" role="status">
          {t("accounts.needFocus")}
        </p>
      ) : null}

      <dl className="tiktokMeta">
        <div>
          <dt>{t("tiktok.meta.events")}</dt>
          <dd>{tiktok.eventCount}</dd>
        </div>
        <div>
          <dt>{t("tiktok.meta.commentsPerMin")}</dt>
          <dd>{tiktok.commentsPerMinute}</dd>
        </div>
        <div>
          <dt>{t("tiktok.meta.connectedFor")}</dt>
          <dd>{formatDuration(tiktok.connectedAt, nowMs)}</dd>
        </div>
        {tiktok.phase === "RECONNECTING" && tiktok.nextRetryMs != null ? (
          <div>
            <dt>{t("tiktok.meta.nextRetry")}</dt>
            <dd>
              {t("tiktok.retryIn", {
                seconds: Math.ceil(tiktok.nextRetryMs / 1000),
                attempt: tiktok.reconnectAttempt
              })}
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="row">
        {tiktok.connected || busy ? (
          <button
            type="button"
            className="ghost"
            disabled={!accountId}
            onClick={() => void disconnect()}
          >
            {t("tiktok.disconnect")}
          </button>
        ) : (
          <button
            type="button"
            className="primary"
            disabled={!accountId || !username.trim() || busy}
            onClick={() => void connect()}
          >
            {t("tiktok.connect")}
          </button>
        )}
      </div>

      {tiktok.phase === "DEPENDENCY_MISSING" ? (
        <p className="tiktokHint">{t("tiktok.dependencyHint")}</p>
      ) : (
        <p className="tiktokHint">{t("tiktok.busHint")}</p>
      )}
    </div>
  );
}
