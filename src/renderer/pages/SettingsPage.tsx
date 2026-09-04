import { useState } from "react";
import { Languages, RotateCcw, Shield } from "lucide-react";
import type { AppSnapshot } from "../../shared/ipc";
import { APP_LOCALES, type AppLocale } from "../../shared/locale";
import { useAppShell } from "../app/AppShellContext";

export function SettingsPage({ snapshot }: { snapshot?: AppSnapshot }) {
  const { t, locale, loading, changeLocale, restartOnboarding, run, refresh, notify } =
    useAppShell();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [psid, setPsid] = useState("");
  const [psidts, setPsidts] = useState("");

  const saveSession = () =>
    run(async () => {
      await window.khepreeLivestreamAI.saveGeminiSession(psid, psidts || undefined);
      setPsid("");
      setPsidts("");
      notify({ tone: "success", title: t("settings.gemini.saved") });
      await refresh();
    });

  const clearSession = () =>
    run(async () => {
      await window.khepreeLivestreamAI.clearGeminiSession();
      notify({ tone: "info", title: t("settings.gemini.cleared") });
      await refresh();
    });

  return (
    <section className="settingsPanel">
      <div className="panel">
        <div className="panelHead">
          <div>
            <h2>{t("settings.languageTitle")}</h2>
            <p>{t("settings.languageSubtitle")}</p>
          </div>
          <Languages />
        </div>
        <div className="form">
          <label>
            {t("settings.languageLabel")}
            <select
              value={locale}
              disabled={loading}
              onChange={(e) => void changeLocale(e.target.value as AppLocale)}
            >
              {APP_LOCALES.map((code) => (
                <option key={code} value={code}>
                  {code === "vi" ? t("settings.languageVi") : t("settings.languageEn")}
                </option>
              ))}
            </select>
          </label>
          <p className="settingsHint">{t("settings.languageSaved")}</p>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 14 }}>
        <div className="panelHead">
          <div>
            <h2>{t("settings.onboardingTitle")}</h2>
            <p>{t("settings.onboardingSubtitle")}</p>
          </div>
          <RotateCcw />
        </div>
        <button
          type="button"
          className="primary"
          disabled={loading}
          onClick={() => void restartOnboarding()}
        >
          {t("settings.onboardingRestart")}
        </button>
      </div>

      <div className="panel" style={{ marginTop: 14 }}>
        <div className="panelHead">
          <div>
            <h2>{t("settings.gemini.advancedTitle")}</h2>
            <p>{t("settings.gemini.advancedSubtitle")}</p>
          </div>
          <Shield />
        </div>
        <p className="settingsHint">{t("settings.gemini.advancedWarn")}</p>
        <button
          type="button"
          className="ghost"
          onClick={() => setAdvancedOpen((v) => !v)}
        >
          {advancedOpen ? t("settings.gemini.hideAdvanced") : t("settings.gemini.showAdvanced")}
        </button>
        {advancedOpen ? (
          <div className="form" style={{ marginTop: 12 }}>
            <p className="importHint">
              {snapshot?.gemini.hasEncryptedSession
                ? t("settings.gemini.hasSession")
                : t("settings.gemini.noSession")}
            </p>
            <label>
              {t("settings.gemini.psid")}
              <input
                value={psid}
                onChange={(e) => setPsid(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                placeholder="Secure_1PSID"
              />
            </label>
            <label>
              {t("settings.gemini.psidts")}
              <input
                value={psidts}
                onChange={(e) => setPsidts(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                placeholder="Secure_1PSIDTS (optional)"
              />
            </label>
            <div className="row geminiActions">
              <button
                type="button"
                className="primary"
                disabled={loading || !psid.trim()}
                onClick={() => void saveSession()}
              >
                {t("settings.gemini.saveConnect")}
              </button>
              <button
                type="button"
                className="ghost"
                disabled={loading || !snapshot?.gemini.hasEncryptedSession}
                onClick={() => void clearSession()}
              >
                {t("settings.gemini.clear")}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
