import React, { useEffect, useState } from "react";
import { useAppShell } from "../../app/AppShellContext";

export function ErrorDialog() {
  const { t, errorDialog, dismissError, setTab, notify } = useAppShell();
  const [showTech, setShowTech] = useState(false);

  useEffect(() => {
    setShowTech(false);
  }, [errorDialog?.error.technicalCode, errorDialog?.error.userMessage]);

  if (!errorDialog) return null;

  const { error, onRetry, checkTab } = errorDialog;

  const copyTech = async () => {
    const blob = [
      `code: ${error.technicalCode}`,
      `group: ${error.group}`,
      error.technicalDetails ? `details: ${error.technicalDetails}` : undefined
    ]
      .filter(Boolean)
      .join("\n");
    try {
      await navigator.clipboard.writeText(blob);
      notify({ tone: "success", title: t("feedback.copied") });
    } catch {
      notify({ tone: "warning", title: t("feedback.copyFailed") });
    }
  };

  return (
    <div
      className="errorDialogRoot"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) dismissError();
      }}
    >
      <div
        className="errorDialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="error-dialog-title"
        aria-describedby="error-dialog-desc"
      >
        <header className="errorDialogHead">
          <p className="errorDialogEyebrow">{t("feedback.errorEyebrow")}</p>
          <h2 id="error-dialog-title">{error.title}</h2>
        </header>
        <p id="error-dialog-desc" className="errorDialogMessage">
          {error.userMessage}
        </p>

        {error.recommendedActions.length > 0 ? (
          <div className="errorDialogActionsBlock">
            <h3>{t("feedback.recommended")}</h3>
            <ul>
              {error.recommendedActions.map((action: string) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="errorDialogButtons">
          {onRetry ? (
            <button
              type="button"
              className="primary"
              onClick={() => {
                dismissError();
                onRetry();
              }}
            >
              {t("feedback.retry")}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              dismissError();
              setTab(checkTab ?? (error.group === "khepree" || error.group === "tiktok" || error.group === "gemini" ? "connections" : "overview"));
            }}
          >
            {t("feedback.checkSystem")}
          </button>
          <button type="button" className="ghost" onClick={dismissError}>
            {t("feedback.close")}
          </button>
        </div>

        <div className="errorTech">
          <button type="button" className="linkish" onClick={() => setShowTech((v) => !v)}>
            {showTech ? t("feedback.hideTech") : t("feedback.showTech")}
          </button>
          {showTech ? (
            <div className="errorTechPanel">
              <p>
                <span>{t("feedback.techCode")}</span>
                <code>{error.technicalCode}</code>
              </p>
              {error.technicalDetails ? (
                <p>
                  <span>{t("feedback.techDetails")}</span>
                  <code className="errorTechDetails">{error.technicalDetails}</code>
                </p>
              ) : null}
              <button type="button" className="ghost" onClick={() => void copyTech()}>
                {t("feedback.copyTech")}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
