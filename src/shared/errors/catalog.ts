import type { ErrorCatalogMeta } from "./types";

/** Known technical codes thrown by main / workers / IPC. */
export const ERROR_CODES = {
  // Khepree
  KHEPREE_ACCESS_REQUIRED: "KHEPREE_ACCESS_REQUIRED",
  KHEPREE_FEATURE_NOT_ALLOWED: "KHEPREE_FEATURE_NOT_ALLOWED",
  KHEPREE_SIGNING_KEY_MISSING: "KHEPREE_SIGNING_KEY_MISSING",
  NO_AUTH_TRANSACTION: "NO_AUTH_TRANSACTION",
  AUTH_TRANSACTION_EXPIRED: "AUTH_TRANSACTION_EXPIRED",
  AUTH_STATE_MISMATCH: "AUTH_STATE_MISMATCH",
  AUTH_CODE_MISSING: "AUTH_CODE_MISSING",
  INVALID_AUTH_CALLBACK: "INVALID_AUTH_CALLBACK",
  ACCESS_TOKEN_MISSING: "ACCESS_TOKEN_MISSING",
  SAFE_STORAGE_UNAVAILABLE: "SAFE_STORAGE_UNAVAILABLE",
  LEASE_KEY_ID_MISMATCH: "LEASE_KEY_ID_MISMATCH",
  LEASE_PRODUCT_MISMATCH: "LEASE_PRODUCT_MISMATCH",
  LEASE_DEVICE_MISMATCH: "LEASE_DEVICE_MISMATCH",
  LEASE_IAT_IN_FUTURE: "LEASE_IAT_IN_FUTURE",
  LEASE_EXPIRED: "LEASE_EXPIRED",
  LEASE_SIGNATURE_INVALID: "LEASE_SIGNATURE_INVALID",

  // TikTok
  TIKTOK_CONNECTOR_NOT_ENABLED_IN_FOUNDATION: "TIKTOK_CONNECTOR_NOT_ENABLED_IN_FOUNDATION",
  TIKTOK_UNIQUE_ID_REQUIRED: "TIKTOK_UNIQUE_ID_REQUIRED",
  TIKTOK_DISCONNECTED: "TIKTOK_DISCONNECTED",
  TIKTOK_DEPENDENCY_MISSING: "TIKTOK_DEPENDENCY_MISSING",
  TIKTOK_CONNECT_FAILED: "TIKTOK_CONNECT_FAILED",

  // Comments
  COMMENT_ID_REQUIRED: "COMMENT_ID_REQUIRED",
  COMMENT_NOT_FOUND: "COMMENT_NOT_FOUND",
  COMMENT_ACCOUNT_ID_MISSING: "COMMENT_ACCOUNT_ID_MISSING",
  COMMENT_ACCOUNT_MISMATCH: "COMMENT_ACCOUNT_MISMATCH",

  // Gemini
  GEMINI_NOT_CONNECTED: "GEMINI_NOT_CONNECTED",
  GEMINI_INIT_FAILED: "GEMINI_INIT_FAILED",
  GEMINI_GENERATION_FAILED: "GEMINI_GENERATION_FAILED",
  GEMINI_DEPENDENCY_MISSING: "GEMINI_DEPENDENCY_MISSING",
  GEMINI_REAUTH_REQUIRED: "GEMINI_REAUTH_REQUIRED",
  GEMINI_QUOTA_EXCEEDED: "GEMINI_QUOTA_EXCEEDED",
  GEMINI_CIRCUIT_OPEN: "GEMINI_CIRCUIT_OPEN",
  GEMINI_BROWSER_LOGIN_FAILED: "GEMINI_BROWSER_LOGIN_FAILED",
  GEMINI_TEST_FAILED: "GEMINI_TEST_FAILED",
  GEMINI_SESSION_REQUIRED: "GEMINI_SESSION_REQUIRED",
  LLM_PROVIDER_INVALID: "LLM_PROVIDER_INVALID",

  // Database
  DATABASE_UNAVAILABLE: "DATABASE_UNAVAILABLE",
  DATABASE_WRITE_FAILED: "DATABASE_WRITE_FAILED",

  // Media / TTS / camera
  MEDIA_NOT_READY: "MEDIA_NOT_READY",
  TTS_UNAVAILABLE: "TTS_UNAVAILABLE",
  VIRTUAL_CAMERA_UNAVAILABLE: "VIRTUAL_CAMERA_UNAVAILABLE",

  // Python worker
  PYTHON_WORKER_NOT_STARTED: "PYTHON_WORKER_NOT_STARTED",
  PYTHON_WORKER_SCRIPT_MISSING: "PYTHON_WORKER_SCRIPT_MISSING",
  PYTHON_WORKER_STARTUP_TIMEOUT: "PYTHON_WORKER_STARTUP_TIMEOUT",

  // Browser / LIVE Manager
  BROWSER_SESSION_FAILED: "BROWSER_SESSION_FAILED",
  SELECTOR_PACK_MISSING: "SELECTOR_PACK_MISSING",

  // Permission / OS
  PERMISSION_DENIED: "PERMISSION_DENIED",
  SAFE_STORAGE_PERMISSION: "SAFE_STORAGE_PERMISSION",

  // GPU
  GPU_UNAVAILABLE: "GPU_UNAVAILABLE",
  GPU_DRIVER_ERROR: "GPU_DRIVER_ERROR",

  // System / approval
  APPROVAL_NOT_PENDING: "APPROVAL_NOT_PENDING",

  // Product DNA
  TITLE_REQUIRED: "TITLE_REQUIRED",
  PRICE_INVALID: "PRICE_INVALID",
  SOURCE_URL_INVALID: "SOURCE_URL_INVALID",
  PRODUCT_NOT_FOUND: "PRODUCT_NOT_FOUND",
  PRODUCT_ID_REQUIRED: "PRODUCT_ID_REQUIRED",
  PRODUCT_INVALID: "PRODUCT_INVALID",

  // License capacity (Khepree plan — not hardware)
  LICENSE_MAX_CONCURRENT_LIVES: "LICENSE_MAX_CONCURRENT_LIVES",
  LICENSE_MAX_TIKTOK_ACCOUNTS: "LICENSE_MAX_TIKTOK_ACCOUNTS",
  LICENSE_MULTI_LIVE_REQUIRED: "LICENSE_MULTI_LIVE_REQUIRED",

  // Hardware capacity (ResourceGovernor — not license)
  HARDWARE_RAM_LOW: "HARDWARE_RAM_LOW",
  HARDWARE_CPU_HIGH: "HARDWARE_CPU_HIGH",
  HARDWARE_TOO_MANY_RUNTIMES: "HARDWARE_TOO_MANY_RUNTIMES",
  HARDWARE_TOO_MANY_TIKTOK_WORKERS: "HARDWARE_TOO_MANY_TIKTOK_WORKERS",
  HARDWARE_TOO_MANY_BROWSER_CONTEXTS: "HARDWARE_TOO_MANY_BROWSER_CONTEXTS",
  HARDWARE_AI_QUEUE_BACKLOG: "HARDWARE_AI_QUEUE_BACKLOG",
  HARDWARE_CAPACITY: "HARDWARE_CAPACITY",

  UNKNOWN: "UNKNOWN"
} as const;

export type KnownErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export const ERROR_META: Record<string, ErrorCatalogMeta> = {
  [ERROR_CODES.KHEPREE_ACCESS_REQUIRED]: {
    code: ERROR_CODES.KHEPREE_ACCESS_REQUIRED,
    group: "khepree",
    severity: "error"
  },
  [ERROR_CODES.KHEPREE_FEATURE_NOT_ALLOWED]: {
    code: ERROR_CODES.KHEPREE_FEATURE_NOT_ALLOWED,
    group: "khepree",
    severity: "warning"
  },
  [ERROR_CODES.KHEPREE_SIGNING_KEY_MISSING]: {
    code: ERROR_CODES.KHEPREE_SIGNING_KEY_MISSING,
    group: "khepree",
    severity: "error"
  },
  [ERROR_CODES.NO_AUTH_TRANSACTION]: {
    code: ERROR_CODES.NO_AUTH_TRANSACTION,
    group: "khepree",
    severity: "warning"
  },
  [ERROR_CODES.AUTH_TRANSACTION_EXPIRED]: {
    code: ERROR_CODES.AUTH_TRANSACTION_EXPIRED,
    group: "khepree",
    severity: "warning"
  },
  [ERROR_CODES.AUTH_STATE_MISMATCH]: {
    code: ERROR_CODES.AUTH_STATE_MISMATCH,
    group: "khepree",
    severity: "warning"
  },
  [ERROR_CODES.AUTH_CODE_MISSING]: {
    code: ERROR_CODES.AUTH_CODE_MISSING,
    group: "khepree",
    severity: "error"
  },
  [ERROR_CODES.INVALID_AUTH_CALLBACK]: {
    code: ERROR_CODES.INVALID_AUTH_CALLBACK,
    group: "khepree",
    severity: "error"
  },
  [ERROR_CODES.ACCESS_TOKEN_MISSING]: {
    code: ERROR_CODES.ACCESS_TOKEN_MISSING,
    group: "khepree",
    severity: "warning"
  },
  [ERROR_CODES.SAFE_STORAGE_UNAVAILABLE]: {
    code: ERROR_CODES.SAFE_STORAGE_UNAVAILABLE,
    group: "permission",
    severity: "error"
  },
  [ERROR_CODES.LEASE_KEY_ID_MISMATCH]: {
    code: ERROR_CODES.LEASE_KEY_ID_MISMATCH,
    group: "khepree",
    severity: "error"
  },
  [ERROR_CODES.LEASE_PRODUCT_MISMATCH]: {
    code: ERROR_CODES.LEASE_PRODUCT_MISMATCH,
    group: "khepree",
    severity: "error"
  },
  [ERROR_CODES.LEASE_DEVICE_MISMATCH]: {
    code: ERROR_CODES.LEASE_DEVICE_MISMATCH,
    group: "khepree",
    severity: "error"
  },
  [ERROR_CODES.LEASE_IAT_IN_FUTURE]: {
    code: ERROR_CODES.LEASE_IAT_IN_FUTURE,
    group: "khepree",
    severity: "error"
  },
  [ERROR_CODES.LEASE_EXPIRED]: {
    code: ERROR_CODES.LEASE_EXPIRED,
    group: "khepree",
    severity: "warning"
  },
  [ERROR_CODES.LEASE_SIGNATURE_INVALID]: {
    code: ERROR_CODES.LEASE_SIGNATURE_INVALID,
    group: "khepree",
    severity: "error"
  },
  [ERROR_CODES.TIKTOK_CONNECTOR_NOT_ENABLED_IN_FOUNDATION]: {
    code: ERROR_CODES.TIKTOK_CONNECTOR_NOT_ENABLED_IN_FOUNDATION,
    group: "tiktok",
    severity: "warning"
  },
  [ERROR_CODES.TIKTOK_UNIQUE_ID_REQUIRED]: {
    code: ERROR_CODES.TIKTOK_UNIQUE_ID_REQUIRED,
    group: "tiktok",
    severity: "warning"
  },
  [ERROR_CODES.TIKTOK_DISCONNECTED]: {
    code: ERROR_CODES.TIKTOK_DISCONNECTED,
    group: "tiktok",
    severity: "error"
  },
  [ERROR_CODES.TIKTOK_DEPENDENCY_MISSING]: {
    code: ERROR_CODES.TIKTOK_DEPENDENCY_MISSING,
    group: "tiktok",
    severity: "error"
  },
  [ERROR_CODES.TIKTOK_CONNECT_FAILED]: {
    code: ERROR_CODES.TIKTOK_CONNECT_FAILED,
    group: "tiktok",
    severity: "error"
  },
  [ERROR_CODES.COMMENT_ID_REQUIRED]: {
    code: ERROR_CODES.COMMENT_ID_REQUIRED,
    group: "system",
    severity: "warning"
  },
  [ERROR_CODES.COMMENT_NOT_FOUND]: {
    code: ERROR_CODES.COMMENT_NOT_FOUND,
    group: "system",
    severity: "warning"
  },
  [ERROR_CODES.COMMENT_ACCOUNT_ID_MISSING]: {
    code: ERROR_CODES.COMMENT_ACCOUNT_ID_MISSING,
    group: "system",
    severity: "error"
  },
  [ERROR_CODES.COMMENT_ACCOUNT_MISMATCH]: {
    code: ERROR_CODES.COMMENT_ACCOUNT_MISMATCH,
    group: "system",
    severity: "error"
  },
  [ERROR_CODES.GEMINI_NOT_CONNECTED]: {
    code: ERROR_CODES.GEMINI_NOT_CONNECTED,
    group: "gemini",
    severity: "warning"
  },
  [ERROR_CODES.GEMINI_INIT_FAILED]: {
    code: ERROR_CODES.GEMINI_INIT_FAILED,
    group: "gemini",
    severity: "error"
  },
  [ERROR_CODES.GEMINI_GENERATION_FAILED]: {
    code: ERROR_CODES.GEMINI_GENERATION_FAILED,
    group: "gemini",
    severity: "error"
  },
  [ERROR_CODES.GEMINI_DEPENDENCY_MISSING]: {
    code: ERROR_CODES.GEMINI_DEPENDENCY_MISSING,
    group: "gemini",
    severity: "error"
  },
  [ERROR_CODES.GEMINI_REAUTH_REQUIRED]: {
    code: ERROR_CODES.GEMINI_REAUTH_REQUIRED,
    group: "gemini",
    severity: "warning"
  },
  [ERROR_CODES.GEMINI_QUOTA_EXCEEDED]: {
    code: ERROR_CODES.GEMINI_QUOTA_EXCEEDED,
    group: "gemini",
    severity: "warning"
  },
  [ERROR_CODES.GEMINI_CIRCUIT_OPEN]: {
    code: ERROR_CODES.GEMINI_CIRCUIT_OPEN,
    group: "gemini",
    severity: "warning"
  },
  [ERROR_CODES.GEMINI_BROWSER_LOGIN_FAILED]: {
    code: ERROR_CODES.GEMINI_BROWSER_LOGIN_FAILED,
    group: "gemini",
    severity: "error"
  },
  [ERROR_CODES.GEMINI_TEST_FAILED]: {
    code: ERROR_CODES.GEMINI_TEST_FAILED,
    group: "gemini",
    severity: "error"
  },
  [ERROR_CODES.GEMINI_SESSION_REQUIRED]: {
    code: ERROR_CODES.GEMINI_SESSION_REQUIRED,
    group: "gemini",
    severity: "warning"
  },
  [ERROR_CODES.LLM_PROVIDER_INVALID]: {
    code: ERROR_CODES.LLM_PROVIDER_INVALID,
    group: "gemini",
    severity: "warning"
  },
  [ERROR_CODES.DATABASE_UNAVAILABLE]: {
    code: ERROR_CODES.DATABASE_UNAVAILABLE,
    group: "database",
    severity: "error"
  },
  [ERROR_CODES.DATABASE_WRITE_FAILED]: {
    code: ERROR_CODES.DATABASE_WRITE_FAILED,
    group: "database",
    severity: "error"
  },
  [ERROR_CODES.MEDIA_NOT_READY]: {
    code: ERROR_CODES.MEDIA_NOT_READY,
    group: "media",
    severity: "warning"
  },
  [ERROR_CODES.TTS_UNAVAILABLE]: {
    code: ERROR_CODES.TTS_UNAVAILABLE,
    group: "media",
    severity: "warning"
  },
  [ERROR_CODES.VIRTUAL_CAMERA_UNAVAILABLE]: {
    code: ERROR_CODES.VIRTUAL_CAMERA_UNAVAILABLE,
    group: "media",
    severity: "warning"
  },
  [ERROR_CODES.PYTHON_WORKER_NOT_STARTED]: {
    code: ERROR_CODES.PYTHON_WORKER_NOT_STARTED,
    group: "python_worker",
    severity: "error"
  },
  [ERROR_CODES.PYTHON_WORKER_SCRIPT_MISSING]: {
    code: ERROR_CODES.PYTHON_WORKER_SCRIPT_MISSING,
    group: "python_worker",
    severity: "error"
  },
  [ERROR_CODES.PYTHON_WORKER_STARTUP_TIMEOUT]: {
    code: ERROR_CODES.PYTHON_WORKER_STARTUP_TIMEOUT,
    group: "python_worker",
    severity: "error"
  },
  [ERROR_CODES.BROWSER_SESSION_FAILED]: {
    code: ERROR_CODES.BROWSER_SESSION_FAILED,
    group: "browser",
    severity: "error"
  },
  [ERROR_CODES.SELECTOR_PACK_MISSING]: {
    code: ERROR_CODES.SELECTOR_PACK_MISSING,
    group: "browser",
    severity: "error"
  },
  [ERROR_CODES.PERMISSION_DENIED]: {
    code: ERROR_CODES.PERMISSION_DENIED,
    group: "permission",
    severity: "error"
  },
  [ERROR_CODES.SAFE_STORAGE_PERMISSION]: {
    code: ERROR_CODES.SAFE_STORAGE_PERMISSION,
    group: "permission",
    severity: "error"
  },
  [ERROR_CODES.GPU_UNAVAILABLE]: {
    code: ERROR_CODES.GPU_UNAVAILABLE,
    group: "gpu",
    severity: "error"
  },
  [ERROR_CODES.GPU_DRIVER_ERROR]: {
    code: ERROR_CODES.GPU_DRIVER_ERROR,
    group: "gpu",
    severity: "error"
  },
  [ERROR_CODES.APPROVAL_NOT_PENDING]: {
    code: ERROR_CODES.APPROVAL_NOT_PENDING,
    group: "system",
    severity: "info"
  },
  [ERROR_CODES.TITLE_REQUIRED]: {
    code: ERROR_CODES.TITLE_REQUIRED,
    group: "product",
    severity: "warning"
  },
  [ERROR_CODES.PRICE_INVALID]: {
    code: ERROR_CODES.PRICE_INVALID,
    group: "product",
    severity: "warning"
  },
  [ERROR_CODES.SOURCE_URL_INVALID]: {
    code: ERROR_CODES.SOURCE_URL_INVALID,
    group: "product",
    severity: "warning"
  },
  [ERROR_CODES.PRODUCT_NOT_FOUND]: {
    code: ERROR_CODES.PRODUCT_NOT_FOUND,
    group: "product",
    severity: "warning"
  },
  [ERROR_CODES.PRODUCT_ID_REQUIRED]: {
    code: ERROR_CODES.PRODUCT_ID_REQUIRED,
    group: "product",
    severity: "warning"
  },
  [ERROR_CODES.PRODUCT_INVALID]: {
    code: ERROR_CODES.PRODUCT_INVALID,
    group: "product",
    severity: "warning"
  },
  [ERROR_CODES.LICENSE_MAX_CONCURRENT_LIVES]: {
    code: ERROR_CODES.LICENSE_MAX_CONCURRENT_LIVES,
    group: "khepree",
    severity: "warning"
  },
  [ERROR_CODES.LICENSE_MAX_TIKTOK_ACCOUNTS]: {
    code: ERROR_CODES.LICENSE_MAX_TIKTOK_ACCOUNTS,
    group: "khepree",
    severity: "warning"
  },
  [ERROR_CODES.LICENSE_MULTI_LIVE_REQUIRED]: {
    code: ERROR_CODES.LICENSE_MULTI_LIVE_REQUIRED,
    group: "khepree",
    severity: "warning"
  },
  [ERROR_CODES.HARDWARE_RAM_LOW]: {
    code: ERROR_CODES.HARDWARE_RAM_LOW,
    group: "system",
    severity: "warning"
  },
  [ERROR_CODES.HARDWARE_CPU_HIGH]: {
    code: ERROR_CODES.HARDWARE_CPU_HIGH,
    group: "system",
    severity: "warning"
  },
  [ERROR_CODES.HARDWARE_TOO_MANY_RUNTIMES]: {
    code: ERROR_CODES.HARDWARE_TOO_MANY_RUNTIMES,
    group: "system",
    severity: "warning"
  },
  [ERROR_CODES.HARDWARE_TOO_MANY_TIKTOK_WORKERS]: {
    code: ERROR_CODES.HARDWARE_TOO_MANY_TIKTOK_WORKERS,
    group: "system",
    severity: "warning"
  },
  [ERROR_CODES.HARDWARE_TOO_MANY_BROWSER_CONTEXTS]: {
    code: ERROR_CODES.HARDWARE_TOO_MANY_BROWSER_CONTEXTS,
    group: "system",
    severity: "warning"
  },
  [ERROR_CODES.HARDWARE_AI_QUEUE_BACKLOG]: {
    code: ERROR_CODES.HARDWARE_AI_QUEUE_BACKLOG,
    group: "system",
    severity: "warning"
  },
  [ERROR_CODES.HARDWARE_CAPACITY]: {
    code: ERROR_CODES.HARDWARE_CAPACITY,
    group: "system",
    severity: "warning"
  },
  [ERROR_CODES.UNKNOWN]: {
    code: ERROR_CODES.UNKNOWN,
    group: "unknown",
    severity: "error"
  }
};

export function lookupErrorMeta(code: string): ErrorCatalogMeta {
  return (
    ERROR_META[code] ?? {
      code: ERROR_CODES.UNKNOWN,
      group: "unknown",
      severity: "error"
    }
  );
}
