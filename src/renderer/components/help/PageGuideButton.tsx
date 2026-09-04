import { BookOpenText } from "lucide-react";
import { useAppShell } from "../../app/AppShellContext";
import { getPageGuide } from "../../help";
import type { AppTab } from "../../app/types";

export function PageGuideButton({ pageId }: { pageId?: AppTab }) {
  const { t, tab, openPageGuide } = useAppShell();
  const id = pageId ?? tab;
  if (!getPageGuide(id)) return null;

  return (
    <button type="button" className="ghost small pageGuideButton" onClick={() => openPageGuide(id)}>
      <BookOpenText size={15} />
      {t("help.pageGuide")}
    </button>
  );
}
