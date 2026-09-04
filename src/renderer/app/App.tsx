import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { AppSnapshot } from "../../shared/ipc";
import type { AppLocale } from "../../shared/locale";
import type { HelpDrawerState } from "../help";
import { createTranslator } from "../i18n";
import { resolveAppError } from "../errors";
import { ErrorDialog, ToastStack, type ErrorDialogState, type ToastItem } from "../components/feedback";
import { HelpDrawer } from "../components/help/HelpDrawer";
import { AppHeader } from "../components/layout/AppHeader";
import { AppSidebar } from "../components/layout/AppSidebar";
import { ComingSoonPage } from "../pages/ComingSoonPage";
import { ConnectionsPage } from "../pages/ConnectionsPage";
import { HelpPage } from "../pages/HelpPage";
import { LiveControlPage } from "../pages/LiveControlPage";
import { CommentsPage } from "../pages/CommentsPage";
import { OnboardingWizard } from "../pages/OnboardingWizard";
import { OverviewPage } from "../pages/OverviewPage";
import { ProductsPage } from "../pages/ProductsPage";
import { SettingsPage } from "../pages/SettingsPage";
import { AppShellProvider } from "./AppShellContext";
import type { AppShellValue, AppTab } from "./types";

let toastSeq = 0;

export function App() {
  const [snapshot, setSnapshot] = useState<AppSnapshot>();
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<AppTab>("overview");
  const [forceOnboarding, setForceOnboarding] = useState(false);
  const [helpDrawer, setHelpDrawer] = useState<HelpDrawerState>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [errorDialog, setErrorDialog] = useState<ErrorDialogState>(null);
  const recoveryNotified = React.useRef(false);

  const locale: AppLocale = snapshot?.locale ?? "vi";
  const t = useMemo(() => createTranslator(locale), [locale]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const refresh = useCallback(async () => {
    setSnapshot(await window.khepreeLivestreamAI.snapshot());
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 1200);
    return () => clearInterval(timer);
  }, [refresh]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const notify = useCallback(
    (input: { tone?: ToastItem["tone"]; title: string; message?: string }) => {
      toastSeq += 1;
      const id = `toast-${toastSeq}`;
      setToasts((prev) => [
        ...prev.slice(-4),
        {
          id,
          tone: input.tone ?? "info",
          title: input.title,
          message: input.message,
          createdAt: Date.now()
        }
      ]);
    },
    []
  );

  useEffect(() => {
    const recovery = snapshot?.sessionRecovery;
    if (!recovery || recovery.recoveredCount <= 0 || recoveryNotified.current) return;
    recoveryNotified.current = true;
    notify({
      tone: "warning",
      title: t("session.recovery.title"),
      message: t("session.recovery.message", { count: recovery.recoveredCount })
    });
  }, [snapshot?.sessionRecovery, notify, t]);

  const dismissError = useCallback(() => setErrorDialog(null), []);

  const presentError = useCallback(
    (
      error: unknown,
      opts?: { onRetry?: () => void; checkTab?: "overview" | "connections" | "live" }
    ) => {
      const resolved = resolveAppError(error, locale);
      setErrorDialog({
        error: resolved,
        onRetry: opts?.onRetry,
        checkTab: opts?.checkTab
      });
    },
    [locale]
  );

  const run = useCallback(
    async (fn: () => Promise<unknown>) => {
      setLoading(true);
      try {
        await fn();
        await refresh();
      } catch (error) {
        presentError(error, { onRetry: () => void run(fn) });
      } finally {
        setLoading(false);
      }
    },
    [refresh, presentError]
  );

  const changeLocale = useCallback(
    async (next: AppLocale) => {
      setLoading(true);
      try {
        await window.khepreeLivestreamAI.setLocale(next);
        await refresh();
      } catch (error) {
        presentError(error, { onRetry: () => void changeLocale(next) });
      } finally {
        setLoading(false);
      }
    },
    [refresh, presentError]
  );

  const restartOnboarding = useCallback(async () => {
    setLoading(true);
    try {
      await window.khepreeLivestreamAI.setOnboarding({ completed: false, currentStep: 1 });
      setForceOnboarding(true);
      setTab("overview");
      await refresh();
    } catch (error) {
      presentError(error, { onRetry: () => void restartOnboarding() });
    } finally {
      setLoading(false);
    }
  }, [refresh, presentError]);

  const openPageGuide = useCallback((pageId: AppTab) => {
    setHelpDrawer({ kind: "page", pageId });
  }, []);

  const openHelpArticle = useCallback((articleId: string) => {
    setHelpDrawer({ kind: "article", articleId });
  }, []);

  const closeHelp = useCallback(() => setHelpDrawer(null), []);

  if (!snapshot) {
    const bootT = createTranslator("vi");
    return <div className="splash">{bootT("app.booting")}</div>;
  }

  const shell: AppShellValue = {
    locale,
    t,
    loading,
    tab,
    setTab,
    refresh,
    run,
    changeLocale,
    restartOnboarding,
    helpDrawer,
    openPageGuide,
    openHelpArticle,
    closeHelp,
    toasts,
    errorDialog,
    notify,
    presentError,
    dismissError,
    dismissToast
  };

  const showOnboarding = forceOnboarding || !snapshot.onboarding.completed;

  return (
    <AppShellProvider value={shell}>
      {showOnboarding ? (
        <OnboardingWizard
          key={forceOnboarding ? "onboarding-restart" : "onboarding-resume"}
          snapshot={snapshot}
          onFinished={() => {
            setForceOnboarding(false);
            setTab("overview");
            void refresh();
          }}
        />
      ) : (
        <div className="shell">
          <AppSidebar snapshot={snapshot} />
          <main>
            <AppHeader snapshot={snapshot} />
            {tab === "overview" && <OverviewPage snapshot={snapshot} />}
            {tab === "live" && <LiveControlPage snapshot={snapshot} />}
            {tab === "comments" && <CommentsPage snapshot={snapshot} />}
            {tab === "products" && <ProductsPage snapshot={snapshot} />}
            {tab === "script" && <ComingSoonPage feature="script" />}
            {tab === "avatar" && <ComingSoonPage feature="avatar" />}
            {tab === "connections" && <ConnectionsPage snapshot={snapshot} />}
            {tab === "logs" && <ComingSoonPage feature="logs" />}
            {tab === "settings" && <SettingsPage snapshot={snapshot} />}
            {tab === "help" && <HelpPage />}
          </main>
          <HelpDrawer />
        </div>
      )}
      <ToastStack />
      <ErrorDialog />
    </AppShellProvider>
  );
}
