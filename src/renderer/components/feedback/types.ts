import type { ResolvedAppError } from "../../errors";

export type ToastTone = "info" | "success" | "warning" | "error";

export type ToastItem = {
  id: string;
  tone: ToastTone;
  title: string;
  message?: string;
  createdAt: number;
};

export type ErrorDialogState = {
  error: ResolvedAppError;
  onRetry?: () => void;
  /** Where “check system” should navigate. */
  checkTab?: "overview" | "connections" | "live";
} | null;

export type FeedbackApi = {
  notify: (input: { tone?: ToastTone; title: string; message?: string }) => void;
  presentError: (
    error: unknown,
    opts?: { onRetry?: () => void; checkTab?: "overview" | "connections" | "live" }
  ) => void;
  dismissError: () => void;
  dismissToast: (id: string) => void;
};
