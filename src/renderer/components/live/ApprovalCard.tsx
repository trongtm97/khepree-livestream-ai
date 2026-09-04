import { useEffect, useMemo, useState } from "react";
import type { ApprovalItem } from "../../../shared/live-types";
import type { CommentFeedItem } from "../../../shared/comment-feed";
import { useAppShell } from "../../app/AppShellContext";
import type { MessageKey } from "../../i18n/types";

const RISK_LABEL: Record<string, MessageKey> = {
  medical: "approval.risk.medical",
  legal: "approval.risk.legal",
  unknown_fact: "approval.risk.unknownFact",
  unknown_product_fact: "approval.risk.unknownFact",
  missing_product_fact: "approval.risk.unknownFact",
  refund: "approval.risk.refund",
  refund_dispute: "approval.risk.refund",
  warranty: "approval.risk.warranty",
  warranty_dispute: "approval.risk.warranty",
  regulated_claim: "approval.risk.legal",
  anti_repetition: "approval.risk.other"
};

function metaString(item: ApprovalItem, key: string): string | undefined {
  const meta = item.proposal.metadata;
  if (!meta || typeof meta !== "object") return undefined;
  const v = (meta as Record<string, unknown>)[key];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function riskLabelKey(tag: string): MessageKey {
  return RISK_LABEL[tag.toLowerCase()] ?? "approval.risk.other";
}

export function ApprovalCard({
  item,
  comments,
  accountId
}: {
  item: ApprovalItem;
  comments: CommentFeedItem[];
  accountId: string;
}) {
  const { t, run, refresh } = useAppShell();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.proposal.speech ?? "");
  const [nowMs, setNowMs] = useState(Date.now());

  const comment = useMemo(() => {
    const eventId = item.proposal.eventId;
    if (!eventId) return undefined;
    return comments.find((c) => c.eventId === eventId || c.id === eventId);
  }, [comments, item.proposal.eventId]);

  const username =
    metaString(item, "viewerUsername") ||
    comment?.username ||
    undefined;
  const displayName =
    metaString(item, "viewerDisplayName") ||
    comment?.displayName ||
    undefined;
  const question =
    metaString(item, "viewerText") ||
    comment?.text ||
    undefined;

  const hasAuto = Boolean(item.autoApproveAt);
  const confidencePct = Math.round(item.proposal.confidence * 100);
  const risks = item.proposal.riskTags;

  useEffect(() => {
    if (!hasAuto) return;
    const timer = setInterval(() => setNowMs(Date.now()), 100);
    return () => clearInterval(timer);
  }, [hasAuto, item.autoApproveAt]);

  const countdown = useMemo(() => {
    if (!item.autoApproveAt) return null;
    const end = Date.parse(item.autoApproveAt);
    const start = Date.parse(item.createdAt);
    const total = Math.max(1, end - start);
    const remainingMs = Math.max(0, end - nowMs);
    const remainingSec = remainingMs / 1000;
    const progress = Math.min(1, Math.max(0, remainingMs / total));
    return { remainingSec, progress };
  }, [item.autoApproveAt, item.createdAt, nowMs]);

  const speakNow = () =>
    void run(async () => {
      await window.khepreeLivestreamAI.resolveApproval(accountId, item.id, "approve");
      await refresh();
    });

  const speakEdited = () =>
    void run(async () => {
      await window.khepreeLivestreamAI.resolveApproval(accountId, item.id, "approve", draft);
      setEditing(false);
      await refresh();
    });

  const skip = () =>
    void run(async () => {
      await window.khepreeLivestreamAI.resolveApproval(accountId, item.id, "reject");
      await refresh();
    });

  const cancelAuto = () =>
    void run(async () => {
      await window.khepreeLivestreamAI.cancelApprovalAuto(accountId, item.id);
      await refresh();
    });

  const stopAuto = () =>
    void run(async () => {
      await window.khepreeLivestreamAI.stopApprovalAutomation(accountId);
      await refresh();
    });

  const handleName = displayName || username;
  const atUser = username ? `@${username.replace(/^@/, "")}` : handleName ? `@${handleName}` : t("approval.unknownViewer");

  return (
    <article className={`approvalCard${hasAuto ? " hasAuto" : ""}`}>
      <div className="approvalViewer">
        <span className="approvalLabel">{t("approval.viewer")}</span>
        <strong>{atUser}</strong>
        {displayName && username ? <span className="approvalDisplayName">{displayName}</span> : null}
      </div>

      <div className="approvalBlock">
        <span className="approvalLabel">{t("approval.question")}</span>
        <p className="approvalQuestion">{question || t("approval.noQuestion")}</p>
      </div>

      <div className="approvalBlock">
        <span className="approvalLabel">{t("approval.aiSpeech")}</span>
        {editing ? (
          <textarea
            className="approvalEdit"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            aria-label={t("approval.aiSpeech")}
          />
        ) : (
          <p className="approvalSpeech">{item.proposal.speech || "—"}</p>
        )}
      </div>

      <dl className="approvalFacts">
        <div>
          <dt>{t("approval.confidenceLabel")}</dt>
          <dd>{t("approval.confidence", { value: confidencePct })}</dd>
        </div>
        <div>
          <dt>{t("approval.reasonLabel")}</dt>
          <dd>{item.proposal.reason}</dd>
        </div>
      </dl>

      {risks.length > 0 ? (
        <div className="approvalRisks" role="status">
          <span className="approvalLabel">{t("approval.riskLabel")}</span>
          <ul>
            {risks.map((tag) => (
              <li key={tag}>{t(riskLabelKey(tag))}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {countdown && hasAuto ? (
        <div className="approvalCountdown" role="status">
          <div className="approvalCountdownText">
            {t("approval.autoIn", { seconds: countdown.remainingSec.toFixed(1) })}
          </div>
          <div className="approvalProgressTrack" aria-hidden>
            <div
              className="approvalProgressBar"
              style={{ width: `${countdown.progress * 100}%` }}
            />
          </div>
          <button type="button" className="ghost small" onClick={() => void cancelAuto()}>
            {t("approval.cancelAuto")}
          </button>
        </div>
      ) : null}

      <div className="approvalActions row">
        {editing ? (
          <>
            <button
              type="button"
              className="primary small"
              disabled={!draft.trim()}
              onClick={() => void speakEdited()}
            >
              {t("approval.speakEdited")}
            </button>
            <button
              type="button"
              className="ghost small"
              onClick={() => {
                setEditing(false);
                setDraft(item.proposal.speech ?? "");
              }}
            >
              {t("approval.cancelEdit")}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="primary small" onClick={() => void speakNow()}>
              {t("approval.speakNow")}
            </button>
            <button
              type="button"
              className="ghost small"
              onClick={() => {
                setDraft(item.proposal.speech ?? "");
                setEditing(true);
              }}
            >
              {t("approval.edit")}
            </button>
            <button type="button" className="ghost small" onClick={() => void skip()}>
              {t("approval.skip")}
            </button>
            <button type="button" className="ghost small" onClick={() => void stopAuto()}>
              {t("approval.stopAuto")}
            </button>
          </>
        )}
      </div>
    </article>
  );
}
