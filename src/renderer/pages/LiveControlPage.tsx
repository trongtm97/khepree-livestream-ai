import type { AppSnapshot } from "../../shared/ipc";
import { useAppShell } from "../app/AppShellContext";
import { ApprovalQueue } from "../components/live/ApprovalQueue";
import { LiveControls } from "../components/live/LiveControls";
import { LiveStatusCards } from "../components/live/LiveStatusCards";
import { RuntimeHealth } from "../components/live/RuntimeHealth";

export function LiveControlPage({ snapshot }: { snapshot: AppSnapshot }) {
  const { t } = useAppShell();
  const showFallback =
    snapshot.gemini.usingFallbackScript || snapshot.gemini.phase === "FALLBACK_SCRIPT";

  return (
    <>
      {showFallback ? (
        <div className="fallbackScriptBanner" role="status">
          {t("gemini.fallbackBanner")}
        </div>
      ) : null}
      <LiveStatusCards snapshot={snapshot} />
      <LiveControls snapshot={snapshot} />
      <section className="twoCol">
        <ApprovalQueue
          items={snapshot.approvals}
          comments={snapshot.comments.items}
          accountId={snapshot.focusedAccountId}
        />
        <RuntimeHealth items={snapshot.health} />
      </section>
    </>
  );
}
