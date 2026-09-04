import React, { useEffect } from "react";
import { useAppShell } from "../../app/AppShellContext";
import type { ToastItem } from "./types";

function toneClass(tone: ToastItem["tone"]): string {
  return `toast toast--${tone}`;
}

export function ToastStack() {
  const { t, toasts, dismissToast } = useAppShell();

  useEffect(() => {
    if (!toasts.length) return;
    const timers = toasts.map((toast) =>
      window.setTimeout(() => dismissToast(toast.id), 5200)
    );
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [toasts, dismissToast]);

  if (!toasts.length) return null;

  return (
    <div className="toastStack" aria-live="polite" aria-relevant="additions">
      {toasts.map((toast) => (
        <div key={toast.id} className={toneClass(toast.tone)} role="status">
          <div className="toastBody">
            <strong>{toast.title}</strong>
            {toast.message ? <p>{toast.message}</p> : null}
          </div>
          <button type="button" className="ghost" onClick={() => dismissToast(toast.id)} aria-label={t("feedback.dismiss")}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
