import type { AppSnapshot } from "../../../shared/ipc";
import type { ApprovalItem } from "../../../shared/live-types";
import type { CommentFeedItem } from "../../../shared/comment-feed";
import { useAppShell } from "../../app/AppShellContext";

type QueueRow =
  | {
      kind: "approval";
      id: string;
      accountId: string;
      shop: string;
      handle: string;
      username?: string;
      question?: string;
      speech?: string;
      item: ApprovalItem;
    }
  | {
      kind: "comment";
      id: string;
      accountId: string;
      shop: string;
      handle: string;
      comment: CommentFeedItem;
    }
  | {
      kind: "connection";
      id: string;
      accountId: string;
      shop: string;
      handle: string;
      message?: string;
    };

function shopOf(live: { label?: string; username: string }): { shop: string; handle: string } {
  const handle = live.username.replace(/^@/, "");
  return { shop: live.label?.trim() || handle, handle };
}

function approvalMeta(item: ApprovalItem, key: string): string | undefined {
  const meta = item.proposal.metadata;
  if (!meta || typeof meta !== "object") return undefined;
  const v = (meta as Record<string, unknown>)[key];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function buildRows(snapshot: AppSnapshot): QueueRow[] {
  const byId = new Map(snapshot.lives.map((l) => [l.accountId, l]));
  const rows: QueueRow[] = [];

  for (const item of snapshot.pendingApprovals ?? []) {
    if (item.status !== "PENDING") continue;
    const accountId = item.accountId;
    if (!accountId) continue;
    const live = byId.get(accountId);
    if (!live) continue;
    const { shop, handle } = shopOf(live);
    const comment = item.proposal.eventId
      ? snapshot.comments.items.find(
          (c) => c.eventId === item.proposal.eventId || c.id === item.proposal.eventId
        )
      : undefined;
    rows.push({
      kind: "approval",
      id: `ap-${item.id}`,
      accountId,
      shop,
      handle,
      username:
        approvalMeta(item, "viewerUsername") || comment?.username || undefined,
      question: approvalMeta(item, "viewerText") || comment?.text || undefined,
      speech: item.proposal.speech,
      item
    });
  }

  for (const comment of snapshot.comments.items) {
    if (!(comment.operatorPriority || comment.isImportant || comment.isPurchaseIntent)) continue;
    if (comment.skippedAt) continue;
    const live = byId.get(comment.accountId);
    if (!live) continue;
    const { shop, handle } = shopOf(live);
    rows.push({
      kind: "comment",
      id: `cm-${comment.accountId}-${comment.eventId}`,
      accountId: comment.accountId,
      shop,
      handle,
      comment
    });
  }

  for (const live of snapshot.lives) {
    const phase = live.tiktok?.phase;
    if (phase !== "CONNECTOR_ERROR" && phase !== "DEPENDENCY_MISSING") continue;
    const { shop, handle } = shopOf(live);
    rows.push({
      kind: "connection",
      id: `tk-${live.accountId}`,
      accountId: live.accountId,
      shop,
      handle,
      message: live.tiktok?.message
    });
  }

  return rows.slice(0, 40);
}

export function countOperatorTodos(snapshot: AppSnapshot): number {
  return buildRows(snapshot).length;
}

export function OperatorQueue({ snapshot }: { snapshot: AppSnapshot }) {
  const { t, run, refresh, setTab, notify } = useAppShell();
  const rows = buildRows(snapshot);

  const openAccount = (accountId: string, tab: "live" | "comments" | "connections") =>
    run(async () => {
      await window.khepreeLivestreamAI.setFocusedAccount(accountId);
      setTab(tab);
      await refresh();
    });

  return (
    <section className="panel operatorQueue">
      <div className="panelHead">
        <div>
          <h2>{t("liveCenter.queue.title")}</h2>
          <p>{t("liveCenter.queue.subtitle")}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="tiktokHint" role="status">
          {t("liveCenter.queue.empty")}
        </p>
      ) : (
        <ul className="operatorQueueList">
          {rows.map((row) => (
            <li key={row.id} className="operatorQueueRow">
              <div className="operatorQueueBadges">
                <span className="shopBadge">[{row.shop}]</span>
                <span className="handleBadge">@{row.handle}</span>
              </div>

              {row.kind === "approval" ? (
                <>
                  <p className="operatorQueueLead">
                    {row.username
                      ? t("liveCenter.queue.asks", { user: row.username })
                      : t("liveCenter.queue.approval")}
                  </p>
                  {row.question ? <p className="operatorQueueQuote">“{row.question}”</p> : null}
                  {row.speech ? (
                    <p className="operatorQueueAi">
                      <span>{t("liveCenter.queue.aiIntends")}</span> “{row.speech}”
                    </p>
                  ) : null}
                  <button
                    type="button"
                    className="ghost small"
                    onClick={() => void openAccount(row.accountId, "live")}
                  >
                    {t("liveCenter.queue.review")}
                  </button>
                </>
              ) : null}

              {row.kind === "comment" ? (
                <>
                  <p className="operatorQueueLead">
                    {t("liveCenter.queue.asks", {
                      user: row.comment.username || row.comment.displayName || "—"
                    })}
                  </p>
                  <p className="operatorQueueQuote">“{row.comment.text}”</p>
                  <button
                    type="button"
                    className="ghost small"
                    onClick={() => void openAccount(row.accountId, "comments")}
                  >
                    {t("liveCenter.queue.review")}
                  </button>
                </>
              ) : null}

              {row.kind === "connection" ? (
                <>
                  <p className="operatorQueueLead">{t("liveCenter.queue.connection")}</p>
                  {row.message ? <p className="operatorQueueQuote">{row.message}</p> : null}
                  <button
                    type="button"
                    className="ghost small"
                    onClick={() => {
                      notify({
                        tone: "info",
                        title: t("liveCenter.queue.connectionHint")
                      });
                      void openAccount(row.accountId, "connections");
                    }}
                  >
                    {t("liveCenter.queue.review")}
                  </button>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
