/**
 * Operator-facing avatar library assets (renderer-safe).
 * Preprocess caches live on disk under processedPath — never inside asar.
 */
export type AvatarAssetStatus =
  | "READY"
  | "NEEDS_PROCESSING"
  | "PROCESSING"
  | "ERROR";

/** Engine choice shown in wizard — "auto" picks best available. */
export type AvatarAssetEngine = "auto" | "musetalk-local" | "livetalking";

export type AvatarAsset = {
  id: string;
  name: string;
  engine: AvatarAssetEngine;
  status: AvatarAssetStatus;
  sourcePath: string;
  processedPath?: string;
  previewImagePath?: string;
  /** Provider implementation id (resolved from engine). */
  provider: string;
  version: number;
  /** Fingerprint of source file; mismatch → invalidate preprocess. */
  checksum: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
};

export type AvatarPreprocessJob = {
  jobId: string;
  avatarId: string;
  status: "running" | "done" | "error";
  progress: number;
  message: string;
  errorMessage?: string;
};

export function engineDisplayKey(engine: AvatarAssetEngine): string {
  if (engine === "musetalk-local") return "musetalk-local";
  if (engine === "livetalking") return "livetalking";
  return "auto";
}

export function resolveProviderForEngine(engine: AvatarAssetEngine): string {
  if (engine === "musetalk-local") return "musetalk-local";
  if (engine === "livetalking") return "external-livetalking";
  return "auto";
}
