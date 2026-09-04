import { useEffect } from "react";
import { UserRoundCheck } from "lucide-react";
import type { ApprovalItem } from "../../../shared/live-types";
import type { CommentFeedItem } from "../../../shared/comment-feed";
import { useAppShell } from "../../app/AppShellContext";
import { EmptyState } from "../common/EmptyState";
import { MicroHelp } from "../help/MicroHelp";
import { ApprovalCard } from "./ApprovalCard";

export function ApprovalQueue({
  items,
  comments,
  accountId
}: {
  items: ApprovalItem[];
  comments: CommentFeedItem[];
  /** Focused / owning account — required for Esc cancel + cards without item.accountId. */
  accountId?: string;
}) {
  const { t, run, refresh } = useAppShell();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (!accountId?.trim()) return;
      e.preventDefault();
      void run(async () => {
        await window.khepreeLivestreamAI.cancelNearestApprovalAuto(accountId.trim());
        await refresh();
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run, refresh, accountId]);

  return (
    <div className="panel">
      <div className="panelHead">
        <div>
          <h2 className="headingWithHelp">
            <span>{t("approval.title")}</span>
            <MicroHelp tipId="approval.queue" />
          </h2>
          <p>{t("approval.subtitle")}</p>
          <p className="approvalEscHint" title={t("approval.escTooltip")}>
            {t("approval.escHint")}
          </p>
        </div>
        <UserRoundCheck />
      </div>
      <div className="queue">
        {items.length === 0 ? (
          <EmptyState text={t("approval.empty")} />
        ) : (
          items.map((item) => {
            const id = item.accountId?.trim() || accountId?.trim() || "";
            if (!id) return null;
            return (
              <ApprovalCard key={item.id} item={item} comments={comments} accountId={id} />
            );
          })
        )}
      </div>
    </div>
  );
}
