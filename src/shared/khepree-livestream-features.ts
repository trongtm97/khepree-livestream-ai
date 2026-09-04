/**
 * Livestream capacity feature keys — follow Khepree entitlement naming
 * (see khepree packages/entitlement: `*_enabled`, `max_*`, `max_concurrent_*`).
 *
 * Platform has not seeded livestream rows yet; client resolves with fail-closed
 * defaults until catalog/plan_features register these keys.
 */
export const LIVESTREAM_FEATURE_KEYS = {
  /** Product access (already used by this client). */
  access: "livestream_ai.access",
  /** Boolean — multiple concurrent lives allowed. Convention: `*_enabled`. */
  multiLiveEnabled: "multi_live_enabled",
  /** Integer — TikTok account slots. Convention: `max_*`. */
  maxTikTokAccounts: "max_tiktok_accounts",
  /** Integer — concurrent live sessions. Convention: `max_concurrent_*`. */
  maxConcurrentLives: "max_concurrent_lives"
} as const;

/** Fail-closed defaults when a feature key is absent (never Infinity). */
export const LIVESTREAM_FEATURE_DEFAULTS = {
  multiLiveEnabled: false,
  maxTikTokAccounts: 1,
  maxConcurrentLives: 1
} as const;

/** Explicit limits for KHEPREE_DEV_MOCK — not production defaults. */
export const LIVESTREAM_DEV_MOCK_FEATURES = {
  [LIVESTREAM_FEATURE_KEYS.access]: true,
  supervised_auto: true,
  full_auto: false,
  "devices.max": 1,
  [LIVESTREAM_FEATURE_KEYS.multiLiveEnabled]: true,
  [LIVESTREAM_FEATURE_KEYS.maxTikTokAccounts]: 10,
  [LIVESTREAM_FEATURE_KEYS.maxConcurrentLives]: 5
} as const;

/** Mirror of Khepree MAX_CAPABILITY_INTEGER — prevent accidental infinite grants. */
export const MAX_CAPABILITY_INTEGER = 9_999;

export type LivestreamLicenseLimits = {
  multiLiveEnabled: boolean;
  maxTikTokAccounts: number;
  maxConcurrentLives: number;
};

export function resolveBooleanFeature(
  features: Record<string, boolean | number | string>,
  key: string,
  fallback: boolean
): boolean {
  const v = features[key];
  if (typeof v === "boolean") return v;
  if (v === undefined) return fallback;
  return fallback;
}

export function resolveIntegerFeature(
  features: Record<string, boolean | number | string>,
  key: string,
  fallback: number
): number {
  const v = features[key];
  if (typeof v === "number" && Number.isFinite(v)) {
    return Math.min(MAX_CAPABILITY_INTEGER, Math.max(0, Math.floor(v)));
  }
  return fallback;
}

/**
 * Resolve livestream license caps from Khepree feature map.
 * Missing keys → fail-closed defaults (1 account / 1 concurrent / multi off).
 */
export function resolveLivestreamLicenseLimits(
  features: Record<string, boolean | number | string>
): LivestreamLicenseLimits {
  const multiLiveEnabled = resolveBooleanFeature(
    features,
    LIVESTREAM_FEATURE_KEYS.multiLiveEnabled,
    LIVESTREAM_FEATURE_DEFAULTS.multiLiveEnabled
  );
  let maxConcurrentLives = resolveIntegerFeature(
    features,
    LIVESTREAM_FEATURE_KEYS.maxConcurrentLives,
    LIVESTREAM_FEATURE_DEFAULTS.maxConcurrentLives
  );
  let maxTikTokAccounts = resolveIntegerFeature(
    features,
    LIVESTREAM_FEATURE_KEYS.maxTikTokAccounts,
    LIVESTREAM_FEATURE_DEFAULTS.maxTikTokAccounts
  );

  // multi_live off → hard-cap concurrent lives at 1 (still not Infinity).
  if (!multiLiveEnabled) {
    maxConcurrentLives = Math.min(maxConcurrentLives, 1);
  }

  // At least 1 slot when access is granted; 0 means "none" (fail closed).
  maxConcurrentLives = Math.max(0, maxConcurrentLives);
  maxTikTokAccounts = Math.max(0, maxTikTokAccounts);

  return { multiLiveEnabled, maxTikTokAccounts, maxConcurrentLives };
}
