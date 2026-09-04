import { useMemo, useState } from "react";
import { MessageCircle, Pin } from "lucide-react";
import type { AppSnapshot } from "../../shared/ipc";
import {
  matchesCommentFilter,
  type CommentAiStatus,
  type CommentFeedFilter,
  type CommentFeedItem
} from "../../shared/comment-feed";
import type { CommentIntent } from "../../shared/comment-priority";
import { useAppShell } from "../app/AppShellContext";
import type { MessageKey } from "../i18n/types";

const FILTERS: CommentFeedFilter[] = [
  "all",
  "important",
  "purchase",
  "product_question",
  "replied",
  "skipped"
];

const FILTER_LABEL: Record<CommentFeedFilter, MessageKey> = {
  all: "comments.filter.all",
  important: "comments.filter.important",
  purchase: "comments.filter.purchase",
  product_question: "comments.filter.productQuestion",
  replied: "comments.filter.replied",
  skipped: "comments.filter.skipped"
};

const INTENT_LABEL: Record<CommentIntent, MessageKey> = {
  PURCHASE: "comments.intent.PURCHASE",
  PRODUCT_QUESTION: "comments.intent.PRODUCT_QUESTION",
  GENERAL: "comments.intent.GENERAL",
  SPAM: "comments.intent.SPAM"
};

const AI_LABEL: Record<CommentAiStatus, MessageKey> = {
  NONE: "comments.ai.NONE",
  QUEUED: "comments.ai.QUEUED",
  PENDING_APPROVAL: "comments.ai.PENDING_APPROVAL",
  APPROVED: "comments.ai.APPROVED",
  EXECUTED: "comments.ai.EXECUTED",
  REJECTED: "comments.ai.REJECTED",
  SKIPPED: "comments.ai.SKIPPED"
};

/** Soft render cap on top of main snapshot cap — no unbounded list. */
const RENDER_CAP = 150;

export function CommentsPage({ snapshot }: { snapshot: AppSnapshot }) {
  const { t, run, refresh, setTab } = useAppShell();
  const [filter, setFilter] = useState<CommentFeedFilter>("all");

  const filtered = useMemo(() => {
    const rows = snapshot.comments.items.filter((item) => matchesCommentFilter(item, filter));
    return rows.slice(0, RENDER_CAP);
  }, [snapshot.comments.items, filter]);

  const empty = snapshot.comments.total === 0;
  const tiktokConnected = snapshot.tiktok.connected;

  return (
    <div className="page commentsPage">
      <div className="panel">
        <div className="panelHead">
          <div>
            <h2>{t("comments.title")}</h2>
            <p>{t("comments.subtitle")}</p>
          </div>
          <MessageCircle />
        </div>

        <div className="commentFilters" role="tablist" aria-label={t("comments.filtersLabel")}>
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              className={filter === f ? "active" : ""}
              onClick={() => setFilter(f)}
            >
              {t(FILTER_LABEL[f])}
            </button>
          ))}
        </div>

        <div className="commentFeedMeta">
          <span>
            {t("comments.showing", {
              shown: filtered.length,
              total: snapshot.comments.total
            })}
          </span>
          {snapshot.comments.capped || filtered.length >= RENDER_CAP ? (
            <span className="commentCapNote">{t("comments.capped")}</span>
          ) : null}
        </div>

        {empty ? (
          <div className="commentEmpty" role="status">
            <p>{t("comments.emptyTitle")}</p>
            <p>{t("comments.emptyBody")}</p>
            {!tiktokConnected ? (
              <button type="button" className="primary" onClick={() => setTab("connections")}>
                {t("comments.goConnect")}
              </button>
            ) : null}
          </div>
        ) : filtered.length === 0 ? (
          <div className="commentEmpty" role="status">
            <p>{t("comments.filterEmpty")}</p>
          </div>
        ) : (
          <ul className="commentList">
            {filtered.map((item) => (
              <CommentRow
                key={item.id}
                item={item}
                onPin={() =>
                  void run(async () => {
                    await window.khepreeLivestreamAI.pinComment(item.eventId);
                    await refresh();
                  })
                }
                onReplied={() =>
                  void run(async () => {
                    await window.khepreeLivestreamAI.markCommentReplied(item.eventId);
                    await refresh();
                  })
                }
                onSkip={() =>
                  void run(async () => {
                    await window.khepreeLivestreamAI.skipComment(item.eventId);
                    await refresh();
                  })
                }
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function CommentRow({
  item,
  onPin,
  onReplied,
  onSkip
}: {
  item: CommentFeedItem;
  onPin: () => void;
  onReplied: () => void;
  onSkip: () => void;
}) {
  const { t } = useAppShell();
  const initial = (item.displayName || item.username || "?").slice(0, 1).toUpperCase();
  const time = formatTime(item.timestamp);

  return (
    <li className={`commentRow${item.operatorPriority ? " isPinned" : ""}`}>
      <div className="commentAvatar" aria-hidden>
        {item.avatarUrl ? (
          <img src={item.avatarUrl} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span>{initial}</span>
        )}
      </div>
      <div className="commentBody">
        <div className="commentHead">
          <strong>{item.displayName || item.username || t("comments.anonymous")}</strong>
          {item.username ? <span className="commentUser">@{item.username.replace(/^@/, "")}</span> : null}
          <time dateTime={item.timestamp}>{time}</time>
        </div>
        <p className="commentText">{item.text || "—"}</p>
        <div className="commentTags">
          <span className="commentTag priority">{t("comments.priority", { score: item.priority })}</span>
          <span className={`commentTag intent intent-${item.intent}`}>{t(INTENT_LABEL[item.intent])}</span>
          <span className={`commentTag ai ai-${item.aiStatus}`}>{t(AI_LABEL[item.aiStatus])}</span>
          {item.operatorPriority ? (
            <span className="commentTag pinned">{t("comments.pinnedBadge")}</span>
          ) : null}
        </div>
        <div className="commentActions">
          <button type="button" className="ghost" onClick={onPin} disabled={item.operatorPriority}>
            <Pin size={14} /> {t("comments.pin")}
          </button>
          <button type="button" className="ghost" onClick={onReplied}>
            {t("comments.markReplied")}
          </button>
          <button type="button" className="ghost" onClick={onSkip}>
            {t("comments.skip")}
          </button>
        </div>
      </div>
    </li>
  );
}

function formatTime(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}
