import { app, safeStorage } from "electron";
import fs from "node:fs";
import path from "node:path";

interface StoredSession {
  sessionPublicId: string;
  encryptedRefreshToken: string;
}

export class SessionStore {
  private get filePath(): string {
    const dir = path.join(app.getPath("userData"), "secrets");
    fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, "khepree-session.json");
  }

  load(): { sessionPublicId: string; refreshToken: string } | undefined {
    if (!fs.existsSync(this.filePath)) return undefined;
    if (!safeStorage.isEncryptionAvailable()) throw new Error("SAFE_STORAGE_UNAVAILABLE");
    const data = JSON.parse(fs.readFileSync(this.filePath, "utf8")) as StoredSession;
    return {
      sessionPublicId: data.sessionPublicId,
      refreshToken: safeStorage.decryptString(Buffer.from(data.encryptedRefreshToken, "base64"))
    };
  }

  save(sessionPublicId: string, refreshToken: string): void {
    if (!safeStorage.isEncryptionAvailable()) throw new Error("SAFE_STORAGE_UNAVAILABLE");
    const data: StoredSession = {
      sessionPublicId,
      encryptedRefreshToken: safeStorage.encryptString(refreshToken).toString("base64")
    };
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), { mode: 0o600 });
  }

  clear(): void {
    if (fs.existsSync(this.filePath)) fs.rmSync(this.filePath, { force: true });
  }
}
