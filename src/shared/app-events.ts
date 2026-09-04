/** Safe main → renderer notifications (no secrets). */
export type AppEventType =
  | "LIVE_UPDATED"
  | "COMMENT_RECEIVED"
  | "APPROVAL_UPDATED"
  | "TIKTOK_STATE_CHANGED"
  | "LIVE_MANAGER_STATE_CHANGED"
  | "GEMINI_STATE_CHANGED"
  | "PRODUCTS_CHANGED"
  | "LICENSE_CHANGED"
  | "HEALTH_UPDATED"
  | "OPERATOR_CONTROL_CHANGED";

export type AppEvent = {
  type: AppEventType;
  accountId?: string;
  changedAt: string;
};

export function makeAppEvent(
  type: AppEventType,
  accountId?: string
): AppEvent {
  return {
    type,
    ...(accountId ? { accountId } : {}),
    changedAt: new Date().toISOString()
  };
}
