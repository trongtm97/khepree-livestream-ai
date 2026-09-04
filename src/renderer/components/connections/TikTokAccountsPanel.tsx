import { useState } from "react";
import { Plus, Radio, Trash2, UserRound } from "lucide-react";
import type { AppSnapshot } from "../../../shared/ipc";
import { useAppShell } from "../../app/AppShellContext";

export function TikTokAccountsPanel({ snapshot }: { snapshot: AppSnapshot }) {
  const { t, run, refresh, notify } = useAppShell();
  const [username, setUsername] = useState("");
  const [label, setLabel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editUsername, setEditUsername] = useState("");

  const lives = snapshot.lives;
  const focused = snapshot.focusedAccountId;

  const focus = (accountId: string, handle: string) =>
    run(async () => {
      await window.khepreeLivestreamAI.setFocusedAccount(accountId);
      notify({
        tone: "success",
        title: t("accounts.toast.focused", { username: handle })
      });
      await refresh();
    });

  const create = () =>
    run(async () => {
      const created = await window.khepreeLivestreamAI.createTikTokAccount({
        username,
        label: label.trim() || undefined
      });
      setUsername("");
      setLabel("");
      notify({ tone: "success", title: t("accounts.toast.created") });
      await window.khepreeLivestreamAI.setFocusedAccount(created.id);
      await refresh();
    });

  const saveUsername = (accountId: string) =>
    run(async () => {
      await window.khepreeLivestreamAI.updateTikTokAccount(accountId, {
        username: editUsername
      });
      setEditingId(null);
      notify({ tone: "success", title: t("accounts.toast.updated") });
      await refresh();
    });

  const remove = (accountId: string, handle: string) => {
    if (!window.confirm(t("accounts.deleteConfirm", { username: handle }))) return;
    void run(async () => {
      await window.khepreeLivestreamAI.deleteTikTokAccount(accountId);
      notify({ tone: "success", title: t("accounts.toast.deleted") });
      await refresh();
    });
  };

  return (
    <div className="panel accountsPanel">
      <div className="panelHead">
        <div>
          <h2>{t("accounts.title")}</h2>
          <p>{t("accounts.subtitle")}</p>
        </div>
        <UserRound />
      </div>

      {lives.length === 0 ? (
        <p className="tiktokHint" role="status">
          {t("accounts.empty")}
        </p>
      ) : (
        <ul className="accountList">
          {lives.map((live) => {
            const isFocused = live.accountId === focused;
            const handle = live.username.replace(/^@/, "");
            const editing = editingId === live.accountId;
            return (
              <li
                key={live.accountId}
                className={`accountRow${isFocused ? " focused" : ""}`}
              >
                <div className="accountRowMain">
                  <strong>
                    @{handle}
                    {live.label ? <span className="accountLabel"> · {live.label}</span> : null}
                  </strong>
                  <span className={`accountLiveBadge ${live.isRunning ? "on" : "off"}`}>
                    <Radio size={12} />
                    {live.isRunning ? t("accounts.running") : t("accounts.stopped")}
                  </span>
                  {isFocused ? (
                    <span className="accountFocusedBadge">{t("accounts.focused")}</span>
                  ) : null}
                </div>

                {editing ? (
                  <div className="accountEditRow">
                    <input
                      value={editUsername}
                      onChange={(e) => setEditUsername(e.target.value)}
                      placeholder={t("tiktok.usernamePlaceholder")}
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <button
                      type="button"
                      className="primary small"
                      onClick={() => void saveUsername(live.accountId)}
                    >
                      {t("accounts.saveUsername")}
                    </button>
                    <button
                      type="button"
                      className="ghost small"
                      onClick={() => setEditingId(null)}
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div className="accountRowActions">
                    {!isFocused ? (
                      <button
                        type="button"
                        className="primary small"
                        onClick={() => void focus(live.accountId, live.username)}
                      >
                        {t("accounts.use")}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="ghost small"
                      disabled={live.isRunning}
                      onClick={() => {
                        setEditingId(live.accountId);
                        setEditUsername(handle);
                      }}
                    >
                      {t("accounts.username")}
                    </button>
                    <button
                      type="button"
                      className="ghost small"
                      disabled={live.isRunning}
                      onClick={() => remove(live.accountId, live.username)}
                      aria-label={t("accounts.delete")}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="accountCreate">
        <h3>{t("accounts.add")}</h3>
        <label className="field">
          <span>{t("accounts.username")}</span>
          <div className="tiktokUsernameRow">
            <span className="tiktokAt">@</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t("tiktok.usernamePlaceholder")}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        </label>
        <label className="field">
          <span>{t("accounts.label")}</span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} />
        </label>
        <button
          type="button"
          className="primary"
          disabled={!username.trim()}
          onClick={() => void create()}
        >
          <Plus size={16} /> {t("accounts.create")}
        </button>
      </div>
    </div>
  );
}
