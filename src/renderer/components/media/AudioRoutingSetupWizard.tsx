/**
 * Guided audio routing setup for one TikTok account (seller-friendly, no WASAPI jargon).
 */
import { useEffect, useMemo, useState } from "react";
import type { AppSnapshot, AudioDeviceInfo, MediaProfile } from "../../../shared/ipc";
import { findAudioDeviceCollision } from "../../../shared/audio-routing";
import { useAppShell } from "../../app/AppShellContext";

const SAMPLE =
  "Xin chào, đây là âm thanh thử của Khepree Livestream AI.";

type Step = 1 | 2 | 3 | 4 | 5;
type Destination = "preview" | "livestream";

function accountLabel(snapshot: AppSnapshot, accountId: string): string {
  const live = snapshot.lives.find((l) => l.accountId === accountId);
  return live?.label || live?.username || accountId;
}

export function AudioRoutingSetupWizard({
  snapshot,
  accountId,
  open,
  onClose,
  onSaved
}: {
  snapshot: AppSnapshot;
  accountId: string;
  open: boolean;
  onClose: () => void;
  onSaved?: (profile: MediaProfile) => void;
}) {
  const { t, loading, run, notify, refresh, openHelpArticle } = useAppShell();
  const [step, setStep] = useState<Step>(1);
  const [destination, setDestination] = useState<Destination | null>(null);
  const [devices, setDevices] = useState<AudioDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [profiles, setProfiles] = useState<MediaProfile[]>([]);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [allowCollision, setAllowCollision] = useState(false);
  const [tested, setTested] = useState(false);

  useEffect(() => {
    if (!open || !accountId) return;
    void (async () => {
      try {
        const [d, mine, others] = await Promise.all([
          window.khepreeLivestreamAI.listAudioDevices(),
          window.khepreeLivestreamAI.getMediaProfile(accountId),
          Promise.all(
            snapshot.lives.map((l) => window.khepreeLivestreamAI.getMediaProfile(l.accountId))
          )
        ]);
        setDevices(d.filter((x) => x.state === "ACTIVE"));
        setProfiles(others);
        if (mine.audioOutputType === "windows-endpoint" && mine.audioOutputDeviceId) {
          setDestination("livestream");
          setDeviceId(mine.audioOutputDeviceId);
        } else if (mine.audioOutputType === "local-preview") {
          setDestination("preview");
        }
      } catch {
        /* empty list ok */
      }
    })();
  }, [open, accountId, snapshot.lives]);

  const collision = useMemo(() => {
    if (destination !== "livestream" || !deviceId) return undefined;
    return findAudioDeviceCollision(accountId, deviceId, profiles);
  }, [accountId, destination, deviceId, profiles]);

  const collisionBlocked = Boolean(collision && !allowCollision);

  if (!open) return null;

  const reset = () => {
    setStep(1);
    setDestination(null);
    setDeviceId("");
    setAdvancedOpen(false);
    setAllowCollision(false);
    setTested(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const savePreviewOnly = () =>
    run(async () => {
      const next = await window.khepreeLivestreamAI.setMediaProfile(accountId, {
        audioOutputType: "local-preview",
        audioOutputDeviceId: null
      });
      onSaved?.(next);
      notify({ tone: "success", title: t("voice.wizard.savedPreview") });
      await refresh();
      close();
    });

  const saveLivestream = () =>
    run(async () => {
      if (!deviceId || collisionBlocked) return;
      const next = await window.khepreeLivestreamAI.setMediaProfile(accountId, {
        audioOutputType: "windows-endpoint",
        audioOutputDeviceId: deviceId,
        allowDeviceCollision: allowCollision || undefined
      });
      onSaved?.(next);
      notify({ tone: "success", title: t("voice.wizard.savedStream") });
      await refresh();
      close();
    });

  const playSample = () =>
    run(async () => {
      // Persist device first so preview routes to the chosen endpoint.
      if (destination === "livestream" && deviceId) {
        await window.khepreeLivestreamAI.setMediaProfile(accountId, {
          audioOutputType: "windows-endpoint",
          audioOutputDeviceId: deviceId,
          allowDeviceCollision: allowCollision || undefined
        });
      }
      await window.khepreeLivestreamAI.previewMediaVoice(accountId, SAMPLE);
      setTested(true);
      notify({ tone: "info", title: t("voice.wizard.testDone") });
      await refresh();
    });

  const shopName = accountLabel(snapshot, accountId);
  const totalSteps = destination === "preview" ? 1 : 5;

  return (
    <div
      className="wizardOverlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="audio-routing-wizard-title"
    >
      <div className="wizardCard">
        <div className="panelHead">
          <div>
            <h2 id="audio-routing-wizard-title">{t("voice.wizard.title")}</h2>
            <p>
              {t("voice.wizard.forShop", { shop: shopName })} ·{" "}
              {t("voice.wizard.step", { n: step, total: totalSteps })}
            </p>
          </div>
          <button type="button" className="ghost small" onClick={close}>
            {t("voice.wizard.close")}
          </button>
        </div>

        {step === 1 ? (
          <div className="wizardBody">
            <p className="wizardLead">{t("voice.wizard.step1.q")}</p>
            <div className="wizardChoices">
              <button
                type="button"
                className={destination === "preview" ? "wizardChoice active" : "wizardChoice"}
                onClick={() => setDestination("preview")}
              >
                <strong>{t("voice.wizard.step1.a")}</strong>
                <span>{t("voice.wizard.step1.aHint")}</span>
              </button>
              <button
                type="button"
                className={destination === "livestream" ? "wizardChoice active" : "wizardChoice"}
                onClick={() => setDestination("livestream")}
              >
                <strong>{t("voice.wizard.step1.b")}</strong>
                <span>{t("voice.wizard.step1.bHint")}</span>
              </button>
            </div>
            <div className="row">
              {destination === "preview" ? (
                <button
                  type="button"
                  className="primary"
                  disabled={loading}
                  onClick={() => void savePreviewOnly()}
                >
                  {t("voice.wizard.finish")}
                </button>
              ) : (
                <button
                  type="button"
                  className="primary"
                  disabled={!destination || loading}
                  onClick={() => setStep(2)}
                >
                  {t("voice.wizard.next")}
                </button>
              )}
            </div>
          </div>
        ) : null}

        {step === 2 && destination === "livestream" ? (
          <div className="wizardBody">
            <p className="wizardLead">{t("voice.wizard.step2.q", { shop: shopName })}</p>
            <p className="settingsHint">{t("voice.wizard.step2.hint")}</p>
            <label>
              {t("voice.wizard.step2.device")}
              <select
                value={deviceId}
                disabled={loading}
                onChange={(e) => {
                  setDeviceId(e.target.value);
                  setAllowCollision(false);
                  setTested(false);
                }}
              >
                <option value="">{t("voice.wizard.step2.pick")}</option>
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            {devices.length === 0 ? (
              <p className="settingsHint" role="status">
                {t("voice.wizard.step2.noDevices")}
              </p>
            ) : null}
            {collision ? (
              <div className="wizardAlert" role="alert">
                <p>
                  {t("voice.wizard.collision", {
                    shop: accountLabel(snapshot, collision.otherAccountId)
                  })}
                </p>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setAdvancedOpen((v) => !v)}
                >
                  {advancedOpen
                    ? t("voice.audio.hideAdvanced")
                    : t("voice.audio.showAdvanced")}
                </button>
                {advancedOpen ? (
                  <label className="wizardCheck">
                    <input
                      type="checkbox"
                      checked={allowCollision}
                      onChange={(e) => setAllowCollision(e.target.checked)}
                    />
                    {t("voice.wizard.collisionOverride")}
                  </label>
                ) : null}
              </div>
            ) : null}
            {advancedOpen && deviceId ? (
              <p className="settingsHint mono">
                {t("voice.audio.endpointId")}: {deviceId}
              </p>
            ) : null}
            <div className="row">
              <button type="button" className="ghost" onClick={() => setStep(1)}>
                {t("voice.wizard.back")}
              </button>
              <button
                type="button"
                className="primary"
                disabled={!deviceId || collisionBlocked || loading}
                onClick={() => setStep(3)}
              >
                {t("voice.wizard.next")}
              </button>
            </div>
          </div>
        ) : null}

        {step === 3 && destination === "livestream" ? (
          <div className="wizardBody">
            <p className="wizardLead">{t("voice.wizard.step3.q")}</p>
            <p className="settingsHint">{SAMPLE}</p>
            <button
              type="button"
              className="primary"
              disabled={loading || collisionBlocked}
              onClick={() => void playSample()}
            >
              {t("voice.wizard.step3.play")}
            </button>
            {tested ? <p className="settingsHint">{t("voice.wizard.step3.heardHint")}</p> : null}
            <div className="row">
              <button type="button" className="ghost" onClick={() => setStep(2)}>
                {t("voice.wizard.back")}
              </button>
              <button
                type="button"
                className="primary"
                disabled={!tested || loading}
                onClick={() => setStep(4)}
              >
                {t("voice.wizard.next")}
              </button>
            </div>
          </div>
        ) : null}

        {step === 4 && destination === "livestream" ? (
          <div className="wizardBody">
            <p className="wizardLead">{t("voice.wizard.step4.title")}</p>
            <ol className="wizardList">
              <li>{t("voice.wizard.step4.a")}</li>
              <li>{t("voice.wizard.step4.b")}</li>
              <li>{t("voice.wizard.step4.c")}</li>
            </ol>
            <p className="settingsHint">{t("voice.wizard.step4.note")}</p>
            <button
              type="button"
              className="ghost"
              onClick={() => openHelpArticle("audio-routing-tiktok")}
            >
              {t("voice.wizard.openHelp")}
            </button>
            <div className="row">
              <button type="button" className="ghost" onClick={() => setStep(3)}>
                {t("voice.wizard.back")}
              </button>
              <button type="button" className="primary" onClick={() => setStep(5)}>
                {t("voice.wizard.next")}
              </button>
            </div>
          </div>
        ) : null}

        {step === 5 && destination === "livestream" ? (
          <div className="wizardBody">
            <p className="wizardLead">{t("voice.wizard.step5.q")}</p>
            <p className="settingsHint">{t("voice.wizard.step5.hint")}</p>
            <div className="row">
              <button type="button" className="ghost" onClick={() => setStep(4)}>
                {t("voice.wizard.back")}
              </button>
              <button
                type="button"
                className="primary"
                disabled={loading || collisionBlocked}
                onClick={() => void saveLivestream()}
              >
                {t("voice.wizard.step5.confirm")}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
