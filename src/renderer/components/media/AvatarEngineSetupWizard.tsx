/**
 * Setup wizard: Thiết lập engine nhân vật (MuseTalk local spike).
 * Does not download models; only saves paths and probes worker.
 */
import { useState } from "react";
import type { AvatarEngineSettings, MediaProfile } from "../../../shared/ipc";
import { useAppShell } from "../../app/AppShellContext";

type Props = {
  accountId: string;
  open: boolean;
  initial?: AvatarEngineSettings;
  onClose: () => void;
  onSaved: (profile: MediaProfile) => void;
};

export function AvatarEngineSetupWizard({
  accountId,
  open,
  initial,
  onClose,
  onSaved
}: Props) {
  const { t, loading, run, notify } = useAppShell();
  const [step, setStep] = useState(0);
  const [serverUrl, setServerUrl] = useState(initial?.serverUrl ?? "http://127.0.0.1:8765");
  const [avatarId, setAvatarId] = useState(initial?.avatarId ?? "avatar1");
  const [modelDir, setModelDir] = useState(initial?.modelDir ?? "");
  const [cacheDir, setCacheDir] = useState(initial?.cacheDir ?? "");
  const [sourceVideoPath, setSourceVideoPath] = useState(initial?.sourceVideoPath ?? "");
  const [probeMsg, setProbeMsg] = useState("");

  if (!open) return null;

  const save = () =>
    run(async () => {
      const next: AvatarEngineSettings = {
        kind: "musetalk-local",
        serverUrl: serverUrl.trim(),
        avatarId: avatarId.trim(),
        modelDir: modelDir.trim(),
        cacheDir: cacheDir.trim() || undefined,
        sourceVideoPath: sourceVideoPath.trim(),
        connectionTimeoutMs: 12_000
      };
      const profile = await window.khepreeLivestreamAI.setMediaProfile(accountId, {
        avatarEngine: next
      });
      const probe = await window.khepreeLivestreamAI.probeAvatarEngine(accountId);
      setProbeMsg(probe.health.message ?? "");
      onSaved(profile);
      notify({
        tone: probe.connected ? "success" : "warning",
        title: probe.connected
          ? t("voice.avatarEngine.connected")
          : t("voice.avatarEngine.disconnected")
      });
      if (probe.connected) onClose();
    });

  return (
    <div className="wizardOverlay" role="dialog" aria-modal="true">
      <div className="wizardCard">
        <header className="panelHead">
          <div>
            <h2>{t("voice.avatarWizard.title")}</h2>
            <p>{t("voice.avatarWizard.subtitle")}</p>
          </div>
          <button type="button" className="ghost" onClick={onClose}>
            {t("voice.avatarWizard.close")}
          </button>
        </header>

        {step === 0 ? (
          <div className="form">
            <p className="settingsHint">{t("voice.avatarWizard.step1")}</p>
            <label>
              {t("voice.avatarEngine.serverUrl")}
              <input value={serverUrl} disabled={loading} onChange={(e) => setServerUrl(e.target.value)} />
            </label>
            <label>
              {t("voice.avatarEngine.avatarId")}
              <input value={avatarId} disabled={loading} onChange={(e) => setAvatarId(e.target.value)} />
            </label>
            <button type="button" className="primary" disabled={loading} onClick={() => setStep(1)}>
              {t("voice.avatarWizard.next")}
            </button>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="form">
            <p className="settingsHint">{t("voice.avatarWizard.step2")}</p>
            <label>
              {t("voice.avatarWizard.modelDir")}
              <input
                value={modelDir}
                disabled={loading}
                placeholder="%APPDATA%\\khepree-livestream-ai\\musetalk-models"
                onChange={(e) => setModelDir(e.target.value)}
              />
            </label>
            <label>
              {t("voice.avatarWizard.cacheDir")}
              <input value={cacheDir} disabled={loading} onChange={(e) => setCacheDir(e.target.value)} />
            </label>
            <label>
              {t("voice.avatarWizard.sourceVideo")}
              <input
                value={sourceVideoPath}
                disabled={loading}
                onChange={(e) => setSourceVideoPath(e.target.value)}
              />
            </label>
            <p className="settingsHint">{t("voice.avatarWizard.noDownload")}</p>
            <div className="rowActions">
              <button type="button" className="ghost" disabled={loading} onClick={() => setStep(0)}>
                {t("voice.avatarWizard.back")}
              </button>
              <button
                type="button"
                className="primary"
                disabled={loading || !modelDir.trim() || !sourceVideoPath.trim()}
                onClick={() => setStep(2)}
              >
                {t("voice.avatarWizard.next")}
              </button>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="form">
            <p className="settingsHint">{t("voice.avatarWizard.step3")}</p>
            {probeMsg ? <p className="settingsHint mono">{probeMsg}</p> : null}
            <p className="settingsHint">{t("voice.avatarWizard.notProd")}</p>
            <div className="rowActions">
              <button type="button" className="ghost" disabled={loading} onClick={() => setStep(1)}>
                {t("voice.avatarWizard.back")}
              </button>
              <button type="button" className="primary" disabled={loading} onClick={() => void save()}>
                {t("voice.avatarWizard.saveProbe")}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
