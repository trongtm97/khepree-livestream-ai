import { useAppShell } from "../app/AppShellContext";
import type { MessageKey } from "../i18n";

type ComingSoonFeature = "comments" | "script" | "avatar" | "logs";

const TITLES: Record<ComingSoonFeature, MessageKey> = {
  comments: "comingSoon.title.comments",
  script: "comingSoon.title.script",
  avatar: "comingSoon.title.avatar",
  logs: "comingSoon.title.logs"
};

const BODIES: Record<ComingSoonFeature, MessageKey> = {
  comments: "comingSoon.body.comments",
  script: "comingSoon.body.script",
  avatar: "comingSoon.body.avatar",
  logs: "comingSoon.body.logs"
};

export function ComingSoonPage({ feature }: { feature: ComingSoonFeature }) {
  const { t } = useAppShell();

  return (
    <section className="comingSoonPage">
      <div className="panel comingSoonPanel">
        <span className="comingSoonBadge">{t("comingSoon.badge")}</span>
        <h2>{t(TITLES[feature])}</h2>
        <p>{t(BODIES[feature])}</p>
        <p className="comingSoonNext">{t("comingSoon.next")}</p>
      </div>
    </section>
  );
}
