import type { AppLocale } from "../../shared/locale";
import type { TranslateFn } from "../i18n";
import type { HelpDrawerState } from "../help";
import type { ErrorDialogState, FeedbackApi, ToastItem } from "../components/feedback";

export type AppTab =
  | "overview"
  | "live"
  | "comments"
  | "products"
  | "script"
  | "avatar"
  | "connections"
  | "history"
  | "settings"
  | "help";

export type RunAction = (fn: () => Promise<unknown>) => Promise<void>;

export interface AppShellValue extends FeedbackApi {
  locale: AppLocale;
  t: TranslateFn;
  loading: boolean;
  tab: AppTab;
  setTab: (tab: AppTab) => void;
  refresh: () => Promise<void>;
  run: RunAction;
  changeLocale: (locale: AppLocale) => Promise<void>;
  restartOnboarding: () => Promise<void>;
  helpDrawer: HelpDrawerState;
  openPageGuide: (pageId: AppTab) => void;
  openHelpArticle: (articleId: string) => void;
  closeHelp: () => void;
  toasts: ToastItem[];
  errorDialog: ErrorDialogState;
}
