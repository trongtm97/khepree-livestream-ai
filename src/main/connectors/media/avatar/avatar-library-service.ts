/**
 * Avatar library service — checksum invalidation, preprocess jobs, delete guards.
 * Preprocess is async so the renderer UI never freezes.
 */
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type {
  AvatarAsset,
  AvatarAssetEngine,
  AvatarPreprocessJob
} from "../../../../shared/avatar-assets";
import { resolveProviderForEngine } from "../../../../shared/avatar-assets";
import type { AvatarAssetRepository, MediaProfileRepository } from "../../../db/repositories";
import type { MultiLiveRuntimeManager } from "../../../live/multi-live-runtime-manager";

export function computeSourceChecksum(sourcePath: string): string {
  const st = fs.statSync(sourcePath);
  const h = createHash("sha256");
  h.update(sourcePath);
  h.update(String(st.size));
  h.update(String(Math.floor(st.mtimeMs)));
  // Sample head for stronger fingerprint without hashing multi-GB video fully.
  const fd = fs.openSync(sourcePath, "r");
  try {
    const buf = Buffer.alloc(Math.min(64 * 1024, st.size));
    const n = fs.readSync(fd, buf, 0, buf.length, 0);
    h.update(buf.subarray(0, n));
  } finally {
    fs.closeSync(fd);
  }
  return h.digest("hex").slice(0, 32);
}

export class AvatarLibraryService {
  private readonly jobs = new Map<string, AvatarPreprocessJob>();
  private readonly assetRoot: string;

  constructor(
    private readonly assets: AvatarAssetRepository,
    private readonly mediaProfiles: MediaProfileRepository,
    private readonly multiLive: MultiLiveRuntimeManager,
    userDataDir: string
  ) {
    this.assetRoot = path.join(userDataDir, "avatar-assets");
    fs.mkdirSync(this.assetRoot, { recursive: true });
  }

  list(): AvatarAsset[] {
    return this.assets.list().map((a) => this.refreshChecksum(a));
  }

  get(id: string): AvatarAsset | undefined {
    const a = this.assets.get(id);
    return a ? this.refreshChecksum(a) : undefined;
  }

  /** If source file changed, drop processed cache and mark NEEDS_PROCESSING. */
  refreshChecksum(asset: AvatarAsset): AvatarAsset {
    if (!fs.existsSync(asset.sourcePath)) {
      if (asset.status !== "ERROR") {
        const next = {
          ...asset,
          status: "ERROR" as const,
          errorMessage: "Source video missing",
          processedPath: undefined,
          updatedAt: new Date().toISOString()
        };
        return this.assets.update(next);
      }
      return asset;
    }
    const checksum = computeSourceChecksum(asset.sourcePath);
    if (checksum !== asset.checksum) {
      const next: AvatarAsset = {
        ...asset,
        checksum,
        status: "NEEDS_PROCESSING",
        processedPath: undefined,
        errorMessage: undefined,
        version: asset.version + 1,
        updatedAt: new Date().toISOString()
      };
      return this.assets.update(next);
    }
    return asset;
  }

  create(input: {
    name: string;
    engine: AvatarAssetEngine;
    sourcePath: string;
    previewImagePath?: string;
  }): AvatarAsset {
    if (!fs.existsSync(input.sourcePath)) {
      throw new Error("AVATAR_SOURCE_MISSING");
    }
    const checksum = computeSourceChecksum(input.sourcePath);
    return this.assets.createDraft({
      name: input.name,
      engine: input.engine,
      sourcePath: input.sourcePath,
      checksum,
      previewImagePath: input.previewImagePath
    });
  }

  rename(id: string, name: string): AvatarAsset {
    const prev = this.get(id);
    if (!prev) throw new Error("AVATAR_NOT_FOUND");
    return this.assets.update({
      ...prev,
      name: name.trim() || prev.name,
      updatedAt: new Date().toISOString()
    });
  }

  /**
   * Clone metadata + source path. Does NOT copy processed model cache.
   */
  duplicate(id: string): AvatarAsset {
    const prev = this.get(id);
    if (!prev) throw new Error("AVATAR_NOT_FOUND");
    const now = new Date().toISOString();
    const copy: AvatarAsset = {
      id: this.assets.newId(),
      name: `${prev.name} (copy)`,
      engine: prev.engine,
      provider: resolveProviderForEngine(prev.engine),
      status: "NEEDS_PROCESSING",
      sourcePath: prev.sourcePath,
      previewImagePath: prev.previewImagePath,
      // intentionally omit processedPath — no unnecessary cache copy
      version: 1,
      checksum: prev.checksum,
      createdAt: now,
      updatedAt: now
    };
    return this.assets.insert(copy);
  }

  delete(id: string): void {
    const using = this.assets.accountsUsingAvatar(id);
    const accountIds = new Set([
      ...using,
      ...this.mediaProfiles.list().map((p) => p.accountId)
    ]);
    for (const accountId of accountIds) {
      const snap = this.multiLive.getSnapshot(accountId);
      if (!snap.isRunning) continue;
      const profile = this.mediaProfiles.getByAccount(accountId);
      if (profile?.selectedAvatarId === id || profile?.avatarEngine.avatarId === id) {
        throw new Error(`AVATAR_IN_USE:${accountId}`);
      }
    }
    for (const accountId of using) {
      this.mediaProfiles.upsert({ accountId, selectedAvatarId: undefined });
    }
    this.assets.delete(id);
  }

  startPreprocess(avatarId: string): AvatarPreprocessJob {
    const asset = this.get(avatarId);
    if (!asset) throw new Error("AVATAR_NOT_FOUND");
    const jobId = `job_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const job: AvatarPreprocessJob = {
      jobId,
      avatarId,
      status: "running",
      progress: 0,
      message: "Starting…"
    };
    this.jobs.set(jobId, job);
    this.assets.update({
      ...asset,
      status: "PROCESSING",
      errorMessage: undefined,
      updatedAt: new Date().toISOString()
    });
    void this.runPreprocess(jobId, asset);
    return { ...job };
  }

  getJob(jobId: string): AvatarPreprocessJob | undefined {
    const j = this.jobs.get(jobId);
    return j ? { ...j } : undefined;
  }

  private async runPreprocess(jobId: string, asset: AvatarAsset): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;
    try {
      const steps = [
        "Reading video…",
        "Detecting face…",
        "Building cache…",
        "Writing metadata…"
      ];
      for (let i = 0; i < steps.length; i++) {
        job.message = steps[i]!;
        job.progress = Math.round(((i + 1) / steps.length) * 100);
        this.jobs.set(jobId, { ...job });
        await new Promise((r) => setTimeout(r, 180));
      }
      const outDir = path.join(this.assetRoot, asset.id);
      fs.mkdirSync(outDir, { recursive: true });
      const processedPath = path.join(outDir, "processed.meta.json");
      fs.writeFileSync(
        processedPath,
        JSON.stringify(
          {
            avatarId: asset.id,
            checksum: asset.checksum,
            provider: asset.provider,
            version: asset.version,
            preparedAt: new Date().toISOString()
          },
          null,
          2
        )
      );
      // Optional preview stub (no ffmpeg in spike)
      const previewPath = path.join(outDir, "preview.txt");
      fs.writeFileSync(previewPath, asset.name);

      const latest = this.assets.get(asset.id);
      if (!latest) throw new Error("AVATAR_NOT_FOUND");
      this.assets.update({
        ...latest,
        status: "READY",
        processedPath,
        previewImagePath: latest.previewImagePath ?? previewPath,
        errorMessage: undefined,
        updatedAt: new Date().toISOString()
      });
      job.status = "done";
      job.progress = 100;
      job.message = "Done";
      this.jobs.set(jobId, { ...job });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      job.status = "error";
      job.errorMessage = message;
      job.message = message;
      this.jobs.set(jobId, { ...job });
      const latest = this.assets.get(asset.id);
      if (latest) {
        this.assets.update({
          ...latest,
          status: "ERROR",
          errorMessage: message,
          updatedAt: new Date().toISOString()
        });
      }
    }
  }
}
