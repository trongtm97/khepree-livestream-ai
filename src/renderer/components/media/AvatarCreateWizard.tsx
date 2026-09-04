/**
 * 6-step avatar creation wizard — seller-friendly, no model jargon.
 */
import { useEffect, useState } from "react";
import type { AvatarAsset, AvatarAssetEngine } from "../../../shared/ipc";
import { useAppShell } from "../../app/AppShellContext";

type Props = {
  open: boolean;
  accountId?: string;
  onClose: () => void;
  onCreated: (asset: AvatarAsset) => void;
};

export function AvatarCreateWizard({ open, accountId, onClose, onCreated }: Props) {
  const { t, loading, run, notify } = useAppShell();
  const [step, setStep] = useState(1);
  const [sourcePath, setSourcePath] = useState("");
  const [name, setName] = useState("");
  const [engine, setEngine] = useState<AvatarAssetEngine>("auto");
  const [advanced, setAdvanced] = useState(false);
  const [draft, setDraft] = useState<AvatarAsset | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState("");

  useEffect(() => {
    if (!open) {
      setStep(1);
      setSourcePath("");
      setName("");
      setEngine("auto");
      setAdvanced(false);
      setDraft(null);
      setJobId(null);
      setProgress(0);
      setProgressMsg("");
    }
  }, [open]);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    const tick = async () => {
      const job = await window.khepreeLivestreamAI.getAvatarPreprocessJob(jobId);
      if (cancelled || !job) return;
      setProgress(job.progress);
      setProgressMsg(job.message);
      if (job.status === "done") {
        const asset = await window.khepreeLivestreamAI.getAvatar(job.avatarId);
        if (asset) setDraft(asset);
        setJobId(null);
        setStep(5);
        return;
      }
      if (job.status === "error") {
        notify({ tone: "error", title: job.errorMessage ?? t("avatar.wizard.preprocessFail") });
        setJobId(null);
        return;
      }
      window.setTimeout(() => void tick(), 200);
    };
    void tick();
    return () => {
      cancelled = true;
    };
  }, [jobId, notify, t]);

  if (!open) return null;

  const pickVideo = () =>
    run(async () => {
      const path = await window.khepreeLivestreamAI.pickAvatarVideo();
      if (path) {
        setSourcePath(path);
        if (!name) {
          const base = path.split(/[/\\]/).pop()?.replace(/\.[^.]+$/, "") ?? "";
          setName(base || t("avatar.wizard.defaultName"));
        }
      }
    });

  const goPreview = () => {
    if (!sourcePath) return;
    setStep(2);
  };

  const startPreprocess = () =>
    run(async () => {
      const asset = await window.khepreeLivestreamAI.createAvatar({
        name: name.trim() || t("avatar.wizard.defaultName"),
        engine,
        sourcePath
      });
      setDraft(asset);
      const job = await window.khepreeLivestreamAI.preprocessAvatar(asset.id);
      setJobId(job.jobId);
      setProgress(job.progress);
      setProgressMsg(job.message);
      setStep(4);
    });

  const testSpeak = () =>
    run(async () => {
      if (!accountId) {
        notify({ tone: "info", title: t("avatar.wizard.testNoAccount") });
        return;
      }
      await window.khepreeLivestreamAI.testAvatarSpeak(
        accountId,
        t("avatar.wizard.sampleLine")
      );
      notify({ tone: "success", title: t("avatar.wizard.testDone") });
    });

  const save = () =>
    run(async () => {
      if (!draft) return;
      if (accountId) {
        await window.khepreeLivestreamAI.selectAvatarForAccount(accountId, draft.id);
      }
      onCreated(draft);
      notify({ tone: "success", title: t("avatar.wizard.saved") });
      onClose();
    });

  return (
    <div className="wizardOverlay" role="dialog" aria-modal="true">
      <div className="wizardCard avatarWizardCard">
        <header className="panelHead">
          <div>
            <h2>{t("avatar.wizard.title")}</h2>
            <p>{t("avatar.wizard.step", { n: step, total: 6 })}</p>
          </div>
          <button type="button" className="ghost" onClick={onClose} disabled={loading}>
            {t("avatar.wizard.close")}
          </button>
        </header>

        {step === 1 ? (
          <div className="form">
            <h3>{t("avatar.wizard.step1Title")}</h3>
            <ul className="avatarTips">
              <li>{t("avatar.wizard.tipFace")}</li>
              <li>{t("avatar.wizard.tipLight")}</li>
              <li>{t("avatar.wizard.tipMouth")}</li>
              <li>{t("avatar.wizard.tipLength")}</li>
            </ul>
            <button type="button" className="primary" disabled={loading} onClick={() => void pickVideo()}>
              {t("avatar.wizard.pickVideo")}
            </button>
            {sourcePath ? <p className="settingsHint mono">{sourcePath}</p> : null}
            <label>
              {t("avatar.wizard.name")}
              <input value={name} disabled={loading} onChange={(e) => setName(e.target.value)} />
            </label>
            <button
              type="button"
              className="primary"
              disabled={loading || !sourcePath}
              onClick={goPreview}
            >
              {t("avatar.wizard.next")}
            </button>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="form">
            <h3>{t("avatar.wizard.step2Title")}</h3>
            <div className="avatarVideoPreview" role="img" aria-label={t("avatar.wizard.previewLabel")}>
              <p>{t("avatar.wizard.previewHint")}</p>
              <p className="mono">{sourcePath}</p>
            </div>
            <div className="rowActions">
              <button type="button" className="ghost" onClick={() => setStep(1)}>
                {t("avatar.wizard.back")}
              </button>
              <button type="button" className="primary" onClick={() => setStep(3)}>
                {t("avatar.wizard.next")}
              </button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="form">
            <h3>{t("avatar.wizard.step3Title")}</h3>
            <button
              type="button"
              className={engine === "auto" && !advanced ? "wizardChoice active" : "wizardChoice"}
              onClick={() => {
                setEngine("auto");
                setAdvanced(false);
              }}
            >
              <strong>{t("avatar.wizard.engineAuto")}</strong>
              <span>{t("avatar.wizard.engineAutoHint")}</span>
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => setAdvanced((v) => !v)}
            >
              {advanced ? t("avatar.wizard.hideAdvanced") : t("avatar.wizard.showAdvanced")}
            </button>
            {advanced ? (
              <div className="wizardChoices">
                <button
                  type="button"
                  className={engine === "musetalk-local" ? "wizardChoice active" : "wizardChoice"}
                  onClick={() => setEngine("musetalk-local")}
                >
                  <strong>{t("avatar.engine.musetalk")}</strong>
                </button>
                <button
                  type="button"
                  className={engine === "livetalking" ? "wizardChoice active" : "wizardChoice"}
                  onClick={() => setEngine("livetalking")}
                >
                  <strong>{t("avatar.engine.livetalking")}</strong>
                </button>
              </div>
            ) : null}
            <div className="rowActions">
              <button type="button" className="ghost" onClick={() => setStep(2)}>
                {t("avatar.wizard.back")}
              </button>
              <button
                type="button"
                className="primary"
                disabled={loading}
                onClick={() => void startPreprocess()}
              >
                {t("avatar.wizard.next")}
              </button>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="form">
            <h3>{t("avatar.wizard.step4Title")}</h3>
            <p className="settingsHint">{progressMsg || t("avatar.wizard.processing")}</p>
            <div className="avatarProgressTrack" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
              <div className="avatarProgressBar" style={{ width: `${progress}%` }} />
            </div>
            <p className="settingsHint">{progress}%</p>
          </div>
        ) : null}

        {step === 5 ? (
          <div className="form">
            <h3>{t("avatar.wizard.step5Title")}</h3>
            <p className="settingsHint">{t("avatar.wizard.testHint")}</p>
            <button type="button" className="primary" disabled={loading} onClick={() => void testSpeak()}>
              {t("avatar.wizard.testSpeak")}
            </button>
            <div className="rowActions">
              <button type="button" className="ghost" onClick={() => setStep(6)}>
                {t("avatar.wizard.skipTest")}
              </button>
              <button type="button" className="primary" onClick={() => setStep(6)}>
                {t("avatar.wizard.next")}
              </button>
            </div>
          </div>
        ) : null}

        {step === 6 ? (
          <div className="form">
            <h3>{t("avatar.wizard.step6Title")}</h3>
            <p className="settingsHint">
              {draft?.name} · {t(`avatar.engine.${draft?.engine ?? "auto"}`)}
            </p>
            <button type="button" className="primary" disabled={loading || !draft} onClick={() => void save()}>
              {t("avatar.wizard.save")}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
