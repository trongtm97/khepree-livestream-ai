import { Volume2, VolumeX } from "lucide-react";
import type { MediaPublicState } from "../../../shared/media-contracts";
import { useAppShell } from "../../app/AppShellContext";
import { intlLocale } from "../../i18n";
import { MicroHelp } from "../help/MicroHelp";

/**
 * Voice output settings + the human-takeover switch.
 *
 * Everything shown here reports real engine state — when no OS speech engine is
 * installed the panel says so instead of implying the AI is talking.
 */
export function VoicePanel({ media }: { media: MediaPublicState }) {
  const { t, locale, run, refresh, notify } = useAppShell();

  const toggleVoice = () =>
    run(async () => {
      const next = await window.khepreeLivestreamAI.setMediaVoiceEnabled(!media.voiceEnabled);
      notify({
        tone: next.voiceEnabled ? "success" : "warning",
        title: next.voiceEnabled ? t("voice.enable") : t("voice.disable")
      });
      await refresh();
    });

  const testVoice = () =>
    run(async () => {
      await window.khepreeLivestreamAI.testMediaSpeech();
      notify({ tone: "info", title: t("voice.testQueued") });
      await refresh();
    });

  const recheck = () =>
    run(async () => {
      await window.khepreeLivestreamAI.refreshMedia();
      await refresh();
    });

  const changeVoice = (value: string) =>
    run(async () => {
      await window.khepreeLivestreamAI.setMediaVoice(value || undefined);
      await refresh();
    });

  const lastSpoken = media.lastSpokenAt
    ? t("voice.lastSpoken", {
        time: new Date(media.lastSpokenAt).toLocaleTimeString(intlLocale(locale))
      })
    : t("voice.neverSpoken");

  return (
    <div className="panel">
      <div className="panelHead">
        <div>
          <h2>{t("voice.title")}</h2>
          <p>{t("voice.subtitle")}</p>
        </div>
        {media.voiceEnabled ? <Volume2 /> : <VolumeX />}
      </div>

      <div className={`statusBox mediaStatusBox ${media.engineAvailable ? "ok" : "warn"}`}>
        <strong>
          {media.engineAvailable ? media.message || t("voice.engineLabel") : t("voice.engineNone")}
        </strong>
        <span>{media.engineAvailable ? t("voice.selectLabel") : t("voice.unavailable")}</span>
      </div>

      {!media.engineAvailable && media.hint ? (
        <p className="tiktokHint" role="status">
          {t("voice.hint")}: {media.hint}
        </p>
      ) : null}

      {media.lastError ? (
        <p className="tiktokHint" role="status">
          {media.lastError}
        </p>
      ) : null}

      <label className="fieldRow">
        <span>
          {t("voice.selectLabel")}
          <MicroHelp tipId="voice.select" />
        </span>
        <select
          value={media.selectedVoice ?? ""}
          disabled={!media.engineAvailable}
          onChange={(e) => void changeVoice(e.target.value)}
        >
          <option value="">{t("voice.systemDefault")}</option>
          {media.voices.map((voice) => (
            <option key={voice} value={voice}>
              {voice}
            </option>
          ))}
        </select>
      </label>

      <div className="row">
        <button
          type="button"
          className={media.voiceEnabled ? "ghost" : "primary"}
          onClick={() => void toggleVoice()}
        >
          {media.voiceEnabled ? t("voice.disable") : t("voice.enable")}
        </button>
        <button
          type="button"
          className="ghost"
          disabled={!media.engineAvailable || !media.voiceEnabled}
          onClick={() => void testVoice()}
        >
          {t("voice.test")}
        </button>
        <button type="button" className="ghost" onClick={() => void recheck()}>
          {t("voice.refresh")}
        </button>
      </div>

      {!media.voiceEnabled ? (
        <p className="startWarnNote" role="status">
          {t("voice.mutedBanner")}
        </p>
      ) : null}

      <ul className="voiceFacts">
        <li>{media.speaking ? t("voice.speaking") : lastSpoken}</li>
        {media.queued > 0 ? <li>{t("voice.queued", { count: media.queued })}</li> : null}
        <li>{t("voice.sceneNote")}</li>
      </ul>

      <details className="voiceExplain">
        <summary>{t("voice.takeoverTitle")}</summary>
        <p>{t("voice.takeoverBody")}</p>
      </details>
    </div>
  );
}
