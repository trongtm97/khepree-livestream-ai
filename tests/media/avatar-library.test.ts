/**
 * Avatar library — checksum invalidation, duplicate without cache copy, delete guard.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { migrate } from "../../src/main/db/connection";
import {
  AvatarAssetRepository,
  MediaProfileRepository,
  TikTokAccountRepository,
  AccountLiveSettingsRepository
} from "../../src/main/db/repositories";
import {
  AvatarLibraryService,
  computeSourceChecksum
} from "../../src/main/connectors/media/avatar/avatar-library-service";
import type { AccountLiveSnapshot } from "../../src/shared/live-types";

function openMem() {
  const db = new Database(":memory:");
  migrate(db);
  return db;
}

function mockMultiLive(running: Record<string, boolean>) {
  return {
    getSnapshot(accountId: string): AccountLiveSnapshot {
      return {
        accountId,
        label: accountId,
        username: accountId,
        isRunning: Boolean(running[accountId]),
        state: running[accountId] ? "RUNNING" : "IDLE",
        automationMode: "SUPERVISED_AUTO",
        pendingApprovalCount: 0,
        health: {
          component: "test",
          status: "OK",
          checkedAt: new Date().toISOString()
        }
      };
    }
  };
}

describe("avatar library service", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs) {
      try {
        fs.rmSync(d, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
    dirs.length = 0;
  });

  it("invalidates preprocess when source checksum changes", () => {
    const db = openMem();
    const assets = new AvatarAssetRepository(db);
    const media = new MediaProfileRepository(db);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "avlib-"));
    dirs.push(tmp);
    const video = path.join(tmp, "face.mp4");
    fs.writeFileSync(video, Buffer.from("AAAA"));
    const svc = new AvatarLibraryService(
      assets,
      media,
      mockMultiLive({}) as never,
      tmp
    );
    const created = svc.create({
      name: "Lan",
      engine: "auto",
      sourcePath: video
    });
    assets.update({
      ...created,
      status: "READY",
      processedPath: path.join(tmp, "processed.meta.json"),
      updatedAt: new Date().toISOString()
    });
    fs.writeFileSync(video, Buffer.from("BBBBBB"));
    const refreshed = svc.get(created.id)!;
    expect(refreshed.status).toBe("NEEDS_PROCESSING");
    expect(refreshed.processedPath).toBeUndefined();
    expect(refreshed.checksum).toBe(computeSourceChecksum(video));
  });

  it("duplicate clones profile without processedPath", () => {
    const db = openMem();
    const assets = new AvatarAssetRepository(db);
    const media = new MediaProfileRepository(db);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "avlib-"));
    dirs.push(tmp);
    const video = path.join(tmp, "face.mp4");
    fs.writeFileSync(video, Buffer.from("CCCC"));
    const svc = new AvatarLibraryService(
      assets,
      media,
      mockMultiLive({}) as never,
      tmp
    );
    const a = svc.create({ name: "A", engine: "musetalk-local", sourcePath: video });
    assets.update({
      ...a,
      status: "READY",
      processedPath: path.join(tmp, "cache-heavy.bin"),
      updatedAt: new Date().toISOString()
    });
    const b = svc.duplicate(a.id);
    expect(b.id).not.toBe(a.id);
    expect(b.name).toContain("copy");
    expect(b.processedPath).toBeUndefined();
    expect(b.status).toBe("NEEDS_PROCESSING");
    expect(b.sourcePath).toBe(a.sourcePath);
  });

  it("blocks delete when avatar is selected on a running live", () => {
    const db = openMem();
    const assets = new AvatarAssetRepository(db);
    const media = new MediaProfileRepository(db);
    const accounts = new TikTokAccountRepository(db);
    new AccountLiveSettingsRepository(db);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "avlib-"));
    dirs.push(tmp);
    const video = path.join(tmp, "face.mp4");
    fs.writeFileSync(video, Buffer.from("DDDD"));
    const acc = accounts.create({
      username: "shop_a",
      displayName: "Shop A"
    });
    const svc = new AvatarLibraryService(
      assets,
      media,
      mockMultiLive({ [acc.id]: true }) as never,
      tmp
    );
    const avatar = svc.create({ name: "B", engine: "auto", sourcePath: video });
    media.ensureForAccount(acc.id);
    media.upsert({ accountId: acc.id, selectedAvatarId: avatar.id });
    expect(() => svc.delete(avatar.id)).toThrow(/AVATAR_IN_USE/);
  });
});
