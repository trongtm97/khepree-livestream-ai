import { useEffect, useState } from "react";
import { Mic2, Volume2, Wand2 } from "lucide-react";
import type {
  AppSnapshot,
  AudioDeviceInfo,
  AvatarEngineSettings,
  LiveTalkingTransport,
  MediaEnginePublicState,
  MediaProfile,
  TtsVoiceInfo
} from "../../shared/ipc";
import {
  LIVE_OUTPUT_MODES,
  type LiveOutputMode
} from "../../shared/live-output-mode";
import { useAppShell } from "../app/AppShellContext";
import { AudioRoutingSetupWizard } from "../components/media/AudioRoutingSetupWizard";
import { AvatarEngineSetupWizard } from "../components/media/AvatarEngineSetupWizard";

export function VoicePage({ snapshot }: { snapshot: AppSnapshot }) {
  const { t, loading, run, notify, refresh, openHelpArticle } = useAppShell();
  const accounts = snapshot.lives;
  const focusedId = snapshot.focusedAccountId ?? accounts[0]?.accountId;
  const [accountId, setAccountId] = useState(focusedId ?? "");
  const [voices, setVoices] = useState<TtsVoiceInfo[]>([]);
  const [profile, setProfile] = useState<MediaProfile | null>(null);
  const [engine, setEngine] = useState<MediaEnginePublicState | null>(null);
  const [devices, setDevices] = useState<AudioDeviceInfo[]>([]);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [avatarAdvancedOpen, setAvatarAdvancedOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [avatarWizardOpen, setAvatarWizardOpen] = useState(false);
  const [previewText, setPreviewText] = useState("Xin chào, đây là giọng thử.");
  const [avatarConnected, setAvatarConnected] = useState<boolean | null>(null);
  const [draftServerUrl, setDraftServerUrl] = useState("");
  const [draftAvatarId, setDraftAvatarId] = useState("");
  const [draftModel, setDraftModel] = useState("wav2lip");
  const [draftTransport, setDraftTransport] = useState<LiveTalkingTransport>("webrtc");
  const [draftTimeout, setDraftTimeout] = useState(8000);

  const live = accounts.find((a) => a.accountId === accountId);
  const outputMode: LiveOutputMode = live?.outputMode ?? "ASSIST_ONLY";
  const avatarEngine = profile?.avatarEngine ?? { kind: "none" as const };

  useEffect(() => {
    if (focusedId && !accountId) setAccountId(focusedId);
  }, [focusedId, accountId]);

  useEffect(() => {
    if (!accountId) return;
    void (async () => {
      try {
        const [v, p, e, d] = await Promise.all([
          window.khepreeLivestreamAI.listMediaVoices(),
          window.khepreeLivestreamAI.getMediaProfile(accountId),
          window.khepreeLivestreamAI.getMediaEngineStatus(),
          window.khepreeLivestreamAI.listAudioDevices()
        ]);
        setVoices(v);
        setProfile(p);
        setEngine(e);
        setDevices(d.filter((x) => x.state === "ACTIVE"));
        const ae = p.avatarEngine;
        setDraftServerUrl(ae.serverUrl ?? "");
        setDraftAvatarId(ae.avatarId ?? "");
        setDraftModel(ae.model ?? "wav2lip");
        setDraftTransport(ae.transport ?? "webrtc");
        setDraftTimeout(ae.connectionTimeoutMs ?? 8000);
        setAvatarConnected(null);
        if (ae.kind === "livetalking" && ae.serverUrl) {
          try {
            const probe = await window.khepreeLivestreamAI.probeAvatarEngine(accountId);
            setAvatarConnected(probe.connected);
          } catch {
            setAvatarConnected(false);
          }
        } else if (ae.kind === "musetalk-local" && ae.serverUrl) {
          try {
            const probe = await window.khepreeLivestreamAI.probeAvatarEngine(accountId);
            setAvatarConnected(probe.connected);
          } catch {
            setAvatarConnected(false);
          }
        }
      } catch {
        /* ignore */
      }
    })();
  }, [accountId]);

  const saveOutputMode = (mode: LiveOutputMode) =>
    run(async () => {
      await window.khepreeLivestreamAI.setLiveOutputMode(accountId, mode);
      notify({ tone: "success", title: t("voice.outputMode.saved") });
      await refresh();
    });

  const saveAvatarEngine = (next: AvatarEngineSettings) =>
    run(async () => {
      const saved = await window.khepreeLivestreamAI.setMediaProfile(accountId, {
        avatarEngine: next
      });
      setProfile(saved);
      notify({ tone: "success", title: t("voice.avatarEngine.saved") });
      if (
        (next.kind === "livetalking" || next.kind === "musetalk-local") &&
        next.serverUrl &&
        next.avatarId
      ) {
        const probe = await window.khepreeLivestreamAI.probeAvatarEngine(accountId);
        setAvatarConnected(probe.connected);
      } else {
        setAvatarConnected(null);
      }
      await refresh();
    });

  const probeAvatar = () =>
    run(async () => {
      const probe = await window.khepreeLivestreamAI.probeAvatarEngine(accountId);
      setAvatarConnected(probe.connected);
      notify({
        tone: probe.connected ? "success" : "warning",
        title: probe.connected
          ? t("voice.avatarEngine.connected")
          : t("voice.avatarEngine.disconnected")
      });
    });

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

  const selectedDevice = devices.find((d) => d.id === profile?.audioOutputDeviceId);
  const routingSummary =
    profile?.audioOutputType === "windows-endpoint" && profile.audioOutputDeviceId
      ? selectedDevice?.name ?? t("voice.audio.deviceMissing")
      : t("voice.audio.localPreview");

  const showVoiceControls = outputMode !== "ASSIST_ONLY";
  const showAudioWizard = outputMode === "VOICE_ONLY" || outputMode === "AVATAR_LIVE";
  const showAvatarNote = outputMode === "AVATAR_PREVIEW" || outputMode === "AVATAR_LIVE";

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

            <div className="voiceOutputMode">
              <h3>{t("voice.outputMode.title")}</h3>
              <p className="settingsHint">{t("voice.outputMode.guide")}</p>
              <div className="wizardChoices">
                {LIVE_OUTPUT_MODES.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={outputMode === mode ? "wizardChoice active" : "wizardChoice"}
                    disabled={loading || !accountId}
                    onClick={() => void saveOutputMode(mode)}
                  >
                    <strong>{t(`voice.outputMode.${mode}`)}</strong>
                    <span>{t(`voice.outputMode.${mode}.hint`)}</span>
                  </button>
                ))}
              </div>
            </div>

            {showVoiceControls ? (
              <>
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
              </>
            ) : (
              <p className="settingsHint">{t("voice.outputMode.assistOnlyNote")}</p>
            )}

            {showAudioWizard ? (
              <div className="voiceAudioSection">
                <h3>{t("voice.audio.title")}</h3>
                <p className="settingsHint">{t("voice.audio.guide")}</p>
                <p className="voiceAudioSummary">
                  <strong>{t("voice.audio.current")}:</strong> {routingSummary}
                </p>
                <button
                  type="button"
                  className="primary"
                  disabled={loading || !accountId}
                  onClick={() => setWizardOpen(true)}
                >
                  <Wand2 size={16} /> {t("voice.wizard.open")}
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => openHelpArticle("audio-routing-tiktok")}
                >
                  {t("voice.wizard.openHelp")}
                </button>
                <button
                  type="button"
                  className="ghost"
                  disabled={loading}
                  onClick={() => setAdvancedOpen((v) => !v)}
                >
                  {advancedOpen ? t("voice.audio.hideAdvanced") : t("voice.audio.showAdvanced")}
                </button>
                {advancedOpen && profile?.audioOutputDeviceId ? (
                  <p className="settingsHint mono">
                    {t("voice.audio.endpointId")}: {profile.audioOutputDeviceId}
                  </p>
                ) : null}
              </div>
            ) : null}

            {showAvatarNote ? (
              <div className="voiceAvatarEngine">
                <h3>{t("voice.avatarEngine.title")}</h3>
                <p className="settingsHint">{t("voice.avatarEngine.guide")}</p>
                <div className="wizardChoices">
                  <button
                    type="button"
                    className={avatarEngine.kind === "none" ? "wizardChoice active" : "wizardChoice"}
                    disabled={loading}
                    onClick={() => void saveAvatarEngine({ kind: "none" })}
                  >
                    <strong>{t("voice.avatarEngine.none")}</strong>
                  </button>
                  <button
                    type="button"
                    className={
                      avatarEngine.kind === "livetalking" ? "wizardChoice active" : "wizardChoice"
                    }
                    disabled={loading}
                    onClick={() =>
                      void saveAvatarEngine({
                        kind: "livetalking",
                        serverUrl: draftServerUrl || avatarEngine.serverUrl,
                        avatarId: draftAvatarId || avatarEngine.avatarId || "wav2lip256_avatar1",
                        model: draftModel || avatarEngine.model || "wav2lip",
                        transport: draftTransport,
                        connectionTimeoutMs: draftTimeout
                      })
                    }
                  >
                    <strong>{t("voice.avatarEngine.livetalking")}</strong>
                  </button>
                  <button
                    type="button"
                    className={
                      avatarEngine.kind === "musetalk-local" ? "wizardChoice active" : "wizardChoice"
                    }
                    disabled={loading}
                    onClick={() => setAvatarWizardOpen(true)}
                  >
                    <strong>{t("voice.avatarEngine.musetalk")}</strong>
                    <span>{t("voice.avatarEngine.musetalkHint")}</span>
                  </button>
                </div>
                <p className="settingsHint" role="status">
                  {avatarEngine.kind === "none"
                    ? t("voice.outputMode.avatarSoon")
                    : avatarConnected
                      ? t("voice.avatarEngine.connected")
                      : t("voice.avatarEngine.disconnected")}
                </p>
                {avatarEngine.kind === "musetalk-local" ? (
                  <button
                    type="button"
                    className="primary"
                    disabled={loading}
                    onClick={() => setAvatarWizardOpen(true)}
                  >
                    {t("voice.avatarWizard.open")}
                  </button>
                ) : null}
                {avatarEngine.kind === "livetalking" ? (
                  <>
                    <button
                      type="button"
                      className="ghost"
                      disabled={loading}
                      onClick={() => void probeAvatar()}
                    >
                      {t("voice.avatarEngine.probe")}
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      disabled={loading}
                      onClick={() => setAvatarAdvancedOpen((v) => !v)}
                    >
                      {avatarAdvancedOpen
                        ? t("voice.avatarEngine.hideAdvanced")
                        : t("voice.avatarEngine.advanced")}
                    </button>
                    {avatarAdvancedOpen ? (
                      <div className="form">
                        <label>
                          {t("voice.avatarEngine.serverUrl")}
                          <input
                            value={draftServerUrl}
                            disabled={loading}
                            placeholder="http://192.168.1.50:8010"
                            onChange={(e) => setDraftServerUrl(e.target.value)}
                          />
                        </label>
                        <label>
                          {t("voice.avatarEngine.avatarId")}
                          <input
                            value={draftAvatarId}
                            disabled={loading}
                            onChange={(e) => setDraftAvatarId(e.target.value)}
                          />
                        </label>
                        <label>
                          {t("voice.avatarEngine.model")}
                          <input
                            value={draftModel}
                            disabled={loading}
                            onChange={(e) => setDraftModel(e.target.value)}
                          />
                        </label>
                        <label>
                          {t("voice.avatarEngine.transport")}
                          <select
                            value={draftTransport}
                            disabled={loading}
                            onChange={(e) =>
                              setDraftTransport(e.target.value as LiveTalkingTransport)
                            }
                          >
                            <option value="webrtc">webrtc</option>
                            <option value="virtualcam">virtualcam</option>
                            <option value="rtmp">rtmp</option>
                            <option value="rtcpush">rtcpush</option>
                          </select>
                        </label>
                        <label>
                          {t("voice.avatarEngine.timeout")}
                          <input
                            type="number"
                            min={500}
                            max={120000}
                            value={draftTimeout}
                            disabled={loading}
                            onChange={(e) => setDraftTimeout(Number(e.target.value) || 8000)}
                          />
                        </label>
                        <button
                          type="button"
                          className="primary"
                          disabled={loading || !draftServerUrl.trim() || !draftAvatarId.trim()}
                          onClick={() =>
                            void saveAvatarEngine({
                              kind: "livetalking",
                              serverUrl: draftServerUrl.trim(),
                              avatarId: draftAvatarId.trim(),
                              model: draftModel.trim() || undefined,
                              transport: draftTransport,
                              connectionTimeoutMs: draftTimeout
                            })
                          }
                        >
                          {t("voice.avatarEngine.saved")}
                        </button>
                        <p className="settingsHint">{t("voice.avatarEngine.docsHint")}</p>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
            ) : null}

            {showVoiceControls ? (
              <>
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
              </>
            ) : null}

            <p className="settingsHint">{t("voice.note")}</p>
          </div>
        )}
      </div>

      <AudioRoutingSetupWizard
        snapshot={snapshot}
        accountId={accountId}
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onSaved={(p) => setProfile(p)}
      />
      <AvatarEngineSetupWizard
        accountId={accountId}
        open={avatarWizardOpen}
        initial={profile?.avatarEngine}
        onClose={() => setAvatarWizardOpen(false)}
        onSaved={(p) => {
          setProfile(p);
          setAvatarConnected(p.avatarEngine.kind === "musetalk-local" ? false : null);
        }}
      />
    </section>
  );
}
