import { useMemo, useState } from "react";
import type { AppSnapshot } from "../../shared/ipc";
import { useAppShell } from "../app/AppShellContext";
import { ApprovalQueue } from "../components/live/ApprovalQueue";
import { LiveControls } from "../components/live/LiveControls";
import { LiveStatusCards } from "../components/live/LiveStatusCards";
import { TikTokConnectorPanel } from "../components/connections/TikTokConnectorPanel";
import { LiveManagerPanel } from "../components/connections/LiveManagerPanel";
import { labelAutomationMode, labelLiveState } from "../i18n";
import type { MessageKey } from "../i18n/types";

type DetailTab =
  | "overview"
  | "comments"
  | "approvals"
  | "products"
  | "connections"
  | "logs";

export function LiveControlPage({ snapshot }: { snapshot: AppSnapshot }) {
  const { t, run, refresh, notify, setTab } = useAppShell();
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");

  const accountId = snapshot.focusedAccountId;
  const live = useMemo(
    () => snapshot.lives.find((l) => l.accountId === accountId),
    [snapshot.lives, accountId]
  );
  const product = snapshot.products.find((p) => p.id === live?.currentProductId);
  const accountComments = accountId
    ? snapshot.comments.items.filter((c) => c.accountId === accountId)
    : [];
  const approvals = (snapshot.pendingApprovals ?? []).filter(
    (a) => a.accountId === accountId && a.status === "PENDING"
  );

  const showFallback =
    snapshot.gemini.usingFallbackScript || snapshot.gemini.phase === "FALLBACK_SCRIPT";

  if (!accountId || !live) {
    return (
      <section className="panel">
        <h2>{t("accountDetail.noFocus.title")}</h2>
        <p className="tiktokHint">{t("accountDetail.noFocus.body")}</p>
        <button type="button" className="primary" onClick={() => setTab("overview")}>
          {t("accountDetail.noFocus.cta")}
        </button>
      </section>
    );
  }

  const handle = live.username.replace(/^@/, "");
  const shop = live.label?.trim() || handle;
  const operatorMode =
    live.operatorMode ??
    snapshot.operatorControl?.byAccount[accountId]?.mode ??
    "AI_ACTIVE";
  const inTakeover = operatorMode === "HUMAN_TAKEOVER";

  const setProduct = (productId: string) =>
    run(async () => {
      await window.khepreeLivestreamAI.setCurrentProduct(
        accountId,
        productId.trim() ? productId : null
      );
      notify({ tone: "success", title: t("accountDetail.productSaved") });
      await refresh();
    });

  const tabs: { id: DetailTab; labelKey: MessageKey }[] = [
    { id: "overview", labelKey: "accountDetail.tab.overview" },
    { id: "comments", labelKey: "accountDetail.tab.comments" },
    { id: "approvals", labelKey: "accountDetail.tab.approvals" },
    { id: "products", labelKey: "accountDetail.tab.products" },
    { id: "connections", labelKey: "accountDetail.tab.connections" },
    { id: "logs", labelKey: "accountDetail.tab.logs" }
  ];

  return (
    <section className="accountDetailPage">
      {showFallback ? (
        <div className="fallbackScriptBanner" role="status">
          {t("gemini.fallbackBanner")}
        </div>
      ) : null}

      {inTakeover ? (
        <div className="takeoverBanner" role="alert">
          {t("operator.takeover.banner", { shop })}
        </div>
      ) : null}

      <header className="accountDetailHeader panel">
        <div>
          <h2>{shop}</h2>
          <p>@{handle}</p>
        </div>
        <dl className="accountDetailHeaderMeta">
          <div>
            <dt>{t("liveCenter.card.live")}</dt>
            <dd>{live.isRunning ? t("liveCenter.card.liveRunning") : t("liveCenter.card.liveOff")}</dd>
          </div>
          <div>
            <dt>{t("liveCenter.card.ai")}</dt>
            <dd>{labelAutomationMode(t, live.automationMode)}</dd>
          </div>
          <div>
            <dt>{t("accountDetail.state")}</dt>
            <dd>{labelLiveState(t, live.state)}</dd>
          </div>
          <div>
            <dt>{t("liveCenter.card.product")}</dt>
            <dd>{product?.title ?? t("liveCenter.card.noProduct")}</dd>
          </div>
        </dl>
      </header>

      <nav className="accountDetailTabs" aria-label={t("accountDetail.tabsAria")}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={detailTab === tab.id ? "active" : ""}
            onClick={() => setDetailTab(tab.id)}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </nav>

      {detailTab === "overview" ? (
        <>
          <LiveStatusCards snapshot={snapshot} />
          <LiveControls snapshot={snapshot} />
        </>
      ) : null}

      {detailTab === "comments" ? (
        <section className="panel">
          <div className="panelHead">
            <div>
              <h2>{t("accountDetail.tab.comments")}</h2>
              <p>{t("accountDetail.comments.hint")}</p>
            </div>
          </div>
          {accountComments.length === 0 ? (
            <p className="tiktokHint">{t("accountDetail.comments.empty")}</p>
          ) : (
            <ul className="accountCommentList">
              {accountComments.slice(0, 40).map((c) => (
                <li key={`${c.accountId}-${c.eventId}`}>
                  <strong>@{c.username || "—"}</strong>
                  <span>{c.text}</span>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="ghost" onClick={() => setTab("comments")}>
            {t("accountDetail.comments.openFull")}
          </button>
        </section>
      ) : null}

      {detailTab === "approvals" ? (
        <ApprovalQueue items={approvals} comments={accountComments} accountId={accountId} />
      ) : null}

      {detailTab === "products" ? (
        <section className="panel">
          <div className="panelHead">
            <div>
              <h2>{t("accountDetail.tab.products")}</h2>
              <p>{t("accountDetail.products.hint")}</p>
            </div>
          </div>
          <label>
            {t("accountDetail.products.current")}
            <select
              value={live.currentProductId ?? ""}
              onChange={(e) => void setProduct(e.target.value)}
            >
              <option value="">{t("liveCenter.wizard.productNone")}</option>
              {snapshot.products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="ghost" onClick={() => setTab("products")}>
            {t("accountDetail.products.manage")}
          </button>
        </section>
      ) : null}

      {detailTab === "connections" ? (
        <div className="accountDetailConnections">
          <TikTokConnectorPanel snapshot={snapshot} tiktok={snapshot.tiktok} />
          <LiveManagerPanel snapshot={snapshot} liveManager={snapshot.liveManager} />
        </div>
      ) : null}

      {detailTab === "logs" ? (
        <section className="panel">
          <div className="panelHead">
            <div>
              <h2>{t("accountDetail.tab.logs")}</h2>
              <p>{t("accountDetail.logs.hint")}</p>
            </div>
          </div>
          <dl className="accountDetailLogMeta">
            <div>
              <dt>{t("accountDetail.logs.session")}</dt>
              <dd>{live.sessionId ?? "—"}</dd>
            </div>
            <div>
              <dt>{t("accountDetail.logs.health")}</dt>
              <dd>
                {live.health.status}: {live.health.message}
              </dd>
            </div>
          </dl>
        </section>
      ) : null}
    </section>
  );
}
