/** Stable error groups for seller-facing UX and support routing. */
export type ErrorGroup =
  | "khepree"
  | "gemini"
  | "tiktok"
  | "database"
  | "media"
  | "python_worker"
  | "browser"
  | "permission"
  | "gpu"
  | "system"
  | "product"
  | "unknown";

export type ErrorSeverity = "info" | "warning" | "error";

/** Locale-agnostic catalog entry (copy lives in renderer). */
export type ErrorCatalogMeta = {
  code: string;
  group: ErrorGroup;
  severity: ErrorSeverity;
};

/** Parsed unknown → safe support payload (no secrets). */
export type ParsedError = {
  code: string;
  group: ErrorGroup;
  severity: ErrorSeverity;
  /** Extra after CODE:… — already candidate for sanitization. */
  rawDetail?: string;
};
