/** Per-account outcome for batch live start/stop (main-process authoritative). */
export type LiveBatchAccountResult = {
  accountId: string;
  reasonCode?: string;
};

export type LiveStartReadyBatchResult = {
  attempted: number;
  started: LiveBatchAccountResult[];
  skipped: LiveBatchAccountResult[];
  failed: LiveBatchAccountResult[];
};

export type LiveStopAllBatchResult = {
  attempted: number;
  stopped: LiveBatchAccountResult[];
  skipped: LiveBatchAccountResult[];
  failed: LiveBatchAccountResult[];
};

/** Stable reason codes for start-ready batch (UI maps these). */
export const LIVE_BATCH_REASONS = {
  ALREADY_RUNNING: "ALREADY_RUNNING",
  NO_PRODUCT: "NO_PRODUCT",
  TIKTOK_DISCONNECTED: "TIKTOK_DISCONNECTED",
  ACCOUNT_DISABLED: "ACCOUNT_DISABLED",
  ACCOUNT_SETTINGS_DISABLED: "ACCOUNT_SETTINGS_DISABLED",
  CAPACITY_LIMIT: "CAPACITY_LIMIT",
  AUDIO_ROUTING_NOT_READY: "AUDIO_ROUTING_NOT_READY",
  OUTPUT_MODE_NOT_READY: "OUTPUT_MODE_NOT_READY"
} as const;

export function isCapacityOrLicenseReason(code: string): boolean {
  const c = code.split(":")[0] ?? code;
  return (
    c === LIVE_BATCH_REASONS.CAPACITY_LIMIT ||
    c.startsWith("LICENSE_") ||
    c.startsWith("HARDWARE_") ||
    c === "AVATAR_LIVE_GPU_DENIED" ||
    c === "KHEPREE_ACCESS_REQUIRED"
  );
}

export function normalizeBatchErrorCode(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "START_FAILED");
  const code = raw.split(":")[0]?.trim() || "START_FAILED";
  if (isCapacityOrLicenseReason(code)) return LIVE_BATCH_REASONS.CAPACITY_LIMIT;
  return code;
}
