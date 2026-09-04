/**
 * "Nhân vật AI" library — cards + create wizard + voice sub-tab.
 */
import { useCallback, useEffect, useState } from "react";
import { Copy, Mic2, Plus, Trash2, UserRound } from "lucide-react";
import type { AppSnapshot, AvatarAsset } from "../../shared/ipc";
import { useAppShell } from "../app/AppShellContext";
import { AvatarCreateWizard } from "../components/media/AvatarCreateWizard";
import { VoicePage } from "./VoicePage";

type HubTab = "characters" | "voice";

function statusTone(status: AvatarAsset["status"]): string {
  if (status === "READY") return "ok";
  if (status === "PROCESSING") return "warn";
  if (status === "ERROR") return "bad";
  return "";
}

export function AvatarLibraryPage({ snapshot }: { snapshot: AppSnapshot }) {
  const { t, loading, run, notify, openHelpArticle } = useAppShell();
  const [hub, setHub] = useState<HubTab>("characters");
  const [assets, setAssets] = useState<AvatarAsset[]>([]);
  const [wizardOpen, setWizardOpen] = useState(false);
  const focusedId = snapshot.focusedAccountId ?? snapshot.lives[0]?.accountId;

  const reload = useCallback(async () => {
    const list = await window.khepreeLivestreamAI.listAvatars();
    setAssets(list);
  }, []);

  useEffect(() => {
    void reload().catch(() => setAssets([]));
  }, [reload]);

  const duplicate = (id: string) =>
    run(async () => {
      await window.khepreeLivestreamAI.duplicateAvatar(id);
      await reload();
      notify({ tone: "success", title: t("avatar.duplicated") });
    });

  const remove = (id: string) =>
    run(async () => {
      try {
        await window.khepreeLivestreamAI.deleteAvatar(id);
        await reload();
        notify({ tone: "info", title: t("avatar.deleted") });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.startsWith("AVATAR_IN_USE")) {
          notify({ tone: "warning", title: t("avatar.deleteBlocked") });
        } else {
          throw err;
        }
      }
    });

  const selectForFocused = (id: string) =>
    run(async () => {
      if (!focusedId) {
        notify({ tone: "warning", title: t("avatar.noAccount") });
        return;
      }
      await window.khepreeLivestreamAI.selectAvatarForAccount(focusedId, id);
      notify({ tone: "success", title: t("avatar.selected") });
    });

  if (hub === "voice") {
    return (
      <section className="avatarHub">
        <div className="avatarHubTabs">
          <button type="button" className="ghost" onClick={() => setHub("characters")}>
            <UserRound size={16} /> {t("avatar.hub.characters")}
          </button>
          <button type="button" className="ghost activeTab">
            <Mic2 size={16} /> {t("avatar.hub.voice")}
          </button>
        </div>
        <VoicePage snapshot={snapshot} />
      </section>
    );
  }

  return (
    <section className="avatarHub">
      <div className="avatarHubTabs">
        <button type="button" className="ghost activeTab">
          <UserRound size={16} /> {t("avatar.hub.characters")}
        </button>
        <button type="button" className="ghost" onClick={() => setHub("voice")}>
          <Mic2 size={16} /> {t("avatar.hub.voice")}
        </button>
      </div>

      <div className="panel">
        <div className="panelHead">
          <div>
            <h2>{t("avatar.title")}</h2>
            <p>{t("avatar.subtitle")}</p>
          </div>
          <div className="rowActions">
            <button type="button" className="ghost" onClick={() => openHelpArticle("avatar-create")}>
              {t("avatar.help")}
            </button>
            <button
              type="button"
              className="primary"
              disabled={loading}
              onClick={() => setWizardOpen(true)}
            >
              <Plus size={16} /> {t("avatar.create")}
            </button>
          </div>
        </div>

        {assets.length === 0 ? (
          <p className="settingsHint">{t("avatar.empty")}</p>
        ) : (
          <div className="avatarGrid">
            {assets.map((a) => (
              <article key={a.id} className="avatarCard">
                <div className="avatarCardPreview" aria-hidden>
                  {a.previewImagePath && /\.(png|jpe?g|webp|gif)$/i.test(a.previewImagePath) ? (
                    <img src={`file://${a.previewImagePath}`} alt="" />
                  ) : (
                    <UserRound size={40} />
                  )}
                </div>
                <h3>{a.name}</h3>
                <p className="settingsHint">{t(`avatar.engine.${a.engine}`)}</p>
                <p className={`avatarStatus ${statusTone(a.status)}`}>
                  {t(`avatar.status.${a.status}`)}
                </p>
                {a.errorMessage ? <p className="settingsHint bad">{a.errorMessage}</p> : null}
                <div className="avatarCardActions">
                  <button
                    type="button"
                    className="ghost small"
                    disabled={loading || a.status !== "READY"}
                    onClick={() => void selectForFocused(a.id)}
                  >
                    {t("avatar.use")}
                  </button>
                  <button
                    type="button"
                    className="ghost small"
                    disabled={loading}
                    onClick={() => void duplicate(a.id)}
                    title={t("avatar.duplicate")}
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    type="button"
                    className="ghost small"
                    disabled={loading}
                    onClick={() => void remove(a.id)}
                    title={t("avatar.delete")}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <AvatarCreateWizard
        open={wizardOpen}
        accountId={focusedId}
        onClose={() => setWizardOpen(false)}
        onCreated={() => {
          void reload();
        }}
      />
    </section>
  );
}
