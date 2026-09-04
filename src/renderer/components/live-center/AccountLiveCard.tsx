import { useEffect, useState } from "react";
import type { AccountLiveSnapshot } from "../../../shared/live-types";
import type { ProductDNA } from "../../../shared/live-types";
import { useAppShell } from "../../app/AppShellContext";
import { formatLiveElapsed } from "../../app/account-start-gate";
import { labelAutomationMode } from "../../i18n";

export function AccountLiveCard({
  live,
  products,
  onOpen,
  onStart,
  onStop
}: {
  live: AccountLiveSnapshot;
  products: ProductDNA[];
  onOpen: () => void;
  onStart: () => void;
  onStop: () => void;
}) {
  const { t } = useAppShell();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!live.isRunning || !live.liveStartedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [live.isRunning, live.liveStartedAt]);

  const handle = live.username.replace(/^@/, "");
  const shop = live.label?.trim() || handle;
  const product = products.find((p) => p.id === live.currentProductId);
  const tiktokOk = Boolean(live.tiktok?.connected);
  const elapsed = live.isRunning ? formatLiveElapsed(live.liveStartedAt, now) : null;
  const cpm = live.tiktok?.commentsPerMinute;

  return (
    <article className={`accountLiveCard ${live.isRunning ? "isLive" : ""}`}>
      <header className="accountLiveCardHead">
        <div>
          <h3>{shop}</h3>
          <p>@{handle}</p>
        </div>
        {live.isRunning ? <span className="livePill">{t("liveCenter.card.liveOn")}</span> : null}
      </header>

      <dl className="accountLiveCardMeta">
        <div>
          <dt>{t("liveCenter.card.tiktok")}</dt>
          <dd className={tiktokOk ? "ok" : "bad"}>
            <span className="dot" aria-hidden />
            {tiktokOk ? t("liveCenter.card.tiktokOk") : t("liveCenter.card.tiktokNo")}
          </dd>
        </div>
        <div>
          <dt>{t("liveCenter.card.live")}</dt>
          <dd className={live.isRunning ? "ok" : ""}>
            {live.isRunning ? (
              <>
                <span className="dot" aria-hidden />
                {elapsed ?? t("liveCenter.card.liveRunning")}
              </>
            ) : (
              t("liveCenter.card.liveOff")
            )}
          </dd>
        </div>
        <div>
          <dt>{t("liveCenter.card.ai")}</dt>
          <dd>{labelAutomationMode(t, live.automationMode)}</dd>
        </div>
        <div>
          <dt>{t("liveCenter.card.product")}</dt>
          <dd>{product?.title ?? t("liveCenter.card.noProduct")}</dd>
        </div>
        <div>
          <dt>{t("liveCenter.card.cpm")}</dt>
          <dd>{typeof cpm === "number" ? cpm : "—"}</dd>
        </div>
        <div>
          <dt>{t("liveCenter.card.pending")}</dt>
          <dd className={live.pendingApprovalCount > 0 ? "warn" : ""}>
            {live.pendingApprovalCount}
          </dd>
        </div>
        <div>
          <dt>{t("liveCenter.card.media")}</dt>
          <dd>{t(`voice.outputMode.${live.outputMode ?? "ASSIST_ONLY"}`)}</dd>
        </div>
      </dl>

      <div className="accountLiveCardActions">
        <button type="button" className="ghost" onClick={onOpen}>
          {t("liveCenter.card.open")}
        </button>
        {live.isRunning ? (
          <button type="button" className="danger" onClick={onStop}>
            {t("liveCenter.card.stopAi")}
          </button>
        ) : (
          <button type="button" className="primary" onClick={onStart}>
            {t("liveCenter.card.start")}
          </button>
        )}
      </div>
    </article>
  );
}
