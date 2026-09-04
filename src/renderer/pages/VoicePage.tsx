import { useEffect, useState } from "react";
import { Mic2, Volume2 } from "lucide-react";
import type { AppSnapshot, MediaEnginePublicState, MediaProfile, TtsVoiceInfo } from "../../shared/ipc";
import { useAppShell } from "../app/AppShellContext";

export function VoicePage({ snapshot }: { snapshot: AppSnapshot }) {
  const { t, loading, run, notify, refresh } = useAppShell();
  const accounts = snapshot.lives;
  const focusedId = snapshot.focusedAccountId ?? accounts[0]?.accountId;
  const [accountId, setAccountId] = useState(focusedId ?? "");
  const [voices, setVoices] = useState<TtsVoiceInfo[]>([]);
  const [profile, setProfile] = useState<MediaProfile | null>(null);
  const [engine, setEngine] = useState<MediaEnginePublicState | null>(null);
  const [previewText, setPreviewText] = useState("Xin chào, đây là giọng thử.");

  useEffect(() => {
    if (focusedId && !accountId) setAccountId(focusedId);
  }, [focusedId, accountId]);

  useEffect(() => {
    if (!accountId) return;
    void (async () => {
      try {
        const [v, p, e] = await Promise.all([
          window.khepreeLivestreamAI.listMediaVoices(),
          window.khepreeLivestreamAI.getMediaProfile(accountId),
          window.khepreeLivestreamAI.getMediaEngineStatus()
        ]);
        setVoices(v);
        setProfile(p);
        setEngine(e);
      } catch {
        /* ignore — UI shows empty */
      }
    })();
  }, [accountId]);

  const saveVoice = (voiceId: string) =>
    run(async () => {
      const next = await window.khepreeLivestreamAI.setMediaProfile(accountId, {
        voiceId: voiceId || null
      });
      setProfile(next);
      notify({ tone: "success", title: t("voice.saved") });
      await refresh();
    });

  const saveRate = (rate: number) =>
    run(async () => {
      const next = await window.khepreeLivestreamAI.setMediaProfile(accountId, { rate });
      setProfile(next);
    });

  const preview = () =>
    run(async () => {
      await window.khepreeLivestreamAI.previewMediaVoice(accountId, previewText);
      notify({ tone: "info", title: t("voice.previewDone") });
    });

  const engineLabel =
    engine?.status === "OK"
      ? t("voice.engine.ok")
      : engine?.status === "DEGRADED"
        ? t("voice.engine.degraded")
        : engine?.status === "DOWN"
          ? t("voice.engine.down")
          : t("voice.engine.unknown");

  return (
    <section className="voicePage">
      <div className="panel">
        <div className="panelHead">
          <div>
            <h2>{t("voice.title")}</h2>
            <p>{t("voice.subtitle")}</p>
          </div>
          <Mic2 />
        </div>

        {accounts.length === 0 ? (
          <p className="settingsHint">{t("voice.noAccount")}</p>
        ) : (
          <div className="form">
            <label>
              {t("voice.account")}
              <select
                value={accountId}
                disabled={loading}
                onChange={(e) => setAccountId(e.target.value)}
              >
                {accounts.map((a) => (
                  <option key={a.accountId} value={a.accountId}>
                    {a.label || a.username || a.accountId}
                  </option>
                ))}
              </select>
            </label>

            <div className="voiceEngineRow" role="status">
              <strong>{t("voice.engine")}</strong>
              <span>
                {engine?.providerId ?? "—"} · {engineLabel}
                {engine ? ` (${engine.voiceCount})` : ""}
              </span>
              <p className="settingsHint">{engine?.message}</p>
            </div>

            <label>
              {t("voice.select")}
              <select
                value={profile?.voiceId ?? ""}
                disabled={loading || !accountId}
                onChange={(e) => void saveVoice(e.target.value)}
              >
                <option value="">{t("voice.default")}</option>
                {voices.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                    {v.locale ? ` (${v.locale})` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label>
              {t("voice.rate")} ({profile?.rate?.toFixed(1) ?? "1.0"})
              <input
                type="range"
                min={0.5}
                max={2}
                step={0.1}
                value={profile?.rate ?? 1}
                disabled={loading || !accountId}
                onChange={(e) => void saveRate(Number(e.target.value))}
              />
            </label>

            <label>
              {t("voice.previewText")}
              <input
                value={previewText}
                disabled={loading}
                onChange={(e) => setPreviewText(e.target.value)}
              />
            </label>

            <button
              type="button"
              className="primary"
              disabled={loading || !accountId}
              onClick={() => void preview()}
            >
              <Volume2 size={16} /> {t("voice.preview")}
            </button>

            <p className="settingsHint">{t("voice.note")}</p>
          </div>
        )}
      </div>
    </section>
  );
}
