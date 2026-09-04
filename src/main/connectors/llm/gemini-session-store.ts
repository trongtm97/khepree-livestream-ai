import { app, safeStorage } from "electron";
import fs from "node:fs";
import path from "node:path";

interface StoredGeminiSession {
  encryptedSecure1PSID: string;
  encryptedSecure1PSIDTS?: string;
  updatedAt: string;
}

/** Encrypts Gemini browser cookies on disk. Never exposed to renderer. */
export class GeminiSessionStore {
  private get filePath(): string {
    const dir = path.join(app.getPath("userData"), "secrets");
    fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, "gemini-session.json");
  }

  hasSession(): boolean {
    return fs.existsSync(this.filePath);
  }

  load(): { secure1PSID: string; secure1PSIDTS?: string } | undefined {
    if (!fs.existsSync(this.filePath)) return undefined;
    if (!safeStorage.isEncryptionAvailable()) throw new Error("SAFE_STORAGE_UNAVAILABLE");
    const data = JSON.parse(fs.readFileSync(this.filePath, "utf8")) as StoredGeminiSession;
    return {
      secure1PSID: safeStorage.decryptString(Buffer.from(data.encryptedSecure1PSID, "base64")),
      secure1PSIDTS: data.encryptedSecure1PSIDTS
        ? safeStorage.decryptString(Buffer.from(data.encryptedSecure1PSIDTS, "base64"))
        : undefined
    };
  }

  save(secure1PSID: string, secure1PSIDTS?: string): void {
    if (!safeStorage.isEncryptionAvailable()) throw new Error("SAFE_STORAGE_UNAVAILABLE");
    const data: StoredGeminiSession = {
      encryptedSecure1PSID: safeStorage.encryptString(secure1PSID).toString("base64"),
      encryptedSecure1PSIDTS: secure1PSIDTS
        ? safeStorage.encryptString(secure1PSIDTS).toString("base64")
        : undefined,
      updatedAt: new Date().toISOString()
    };
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), { mode: 0o600 });
  }

  clear(): void {
    if (fs.existsSync(this.filePath)) fs.rmSync(this.filePath, { force: true });
  }
}
