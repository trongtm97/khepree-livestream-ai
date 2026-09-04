import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { HistoryPage } from "../pages/HistoryPage";
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

  const locale: AppLocale = snapshot?.locale ?? "vi";
  const t = useMemo(() => createTranslator(locale), [locale]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

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


  // Backoff state for background polling — kept in refs so a failed poll never
  // re-renders the shell or re-creates the timer loop.
  const pollFailures = useRef(0);
  const errorShown = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const next = await window.khepreeLivestreamAI.snapshot();
      setSnapshot(next);
      pollFailures.current = 0;
      errorShown.current = false;
      return next;
    } catch (error) {
      pollFailures.current += 1;
      throw error;
    }
  }, []);

  /**
   * Adaptive polling.
   *
   * The console needs a tight loop while live (auto-approve countdowns are only
   * a few seconds long) but a busy stream can also produce hundreds of events,
   * so: fast while live, relaxed when idle, paused entirely when the window is
   * hidden, and backed off when IPC fails instead of hammering a broken channel.
   */
  useEffect(() => {
    const LIVE_MS = 900;
    const IDLE_MS = 2500;
    const MAX_BACKOFF_MS = 15_000;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = (delay: number) => {
      if (cancelled) return;
      timer = setTimeout(tick, delay);
    };

    const tick = async () => {
      if (cancelled) return;
      // A hidden window pays for nothing and cannot be supervised anyway.
      if (typeof document !== "undefined" && document.hidden) {
        schedule(IDLE_MS);
        return;
      }
      const base = snapshot?.liveRunning ? LIVE_MS : IDLE_MS;
      try {
        await refresh();
        schedule(base);
      } catch (error) {
        const backoff = Math.min(base * 2 ** pollFailures.current, MAX_BACKOFF_MS);
        // Surface once; repeated background failures must not spam dialogs.
        if (!errorShown.current) {
          errorShown.current = true;
          presentError(error);
        }
        schedule(backoff);
      }
    };

    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [refresh, presentError, snapshot?.liveRunning]);
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
    refresh: async () => {
      await refresh();
    },
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
            {tab === "history" && <HistoryPage />}
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
