import { app, safeStorage } from "electron";
import { generateKeyPairSync, randomUUID, createPrivateKey, createPublicKey, sign } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

interface StoredIdentity {
  installationId: string;
  publicKeyPem: string;
  encryptedPrivateKeyBase64: string;
}

export class DeviceIdentityService {
  private cache?: StoredIdentity;

  private get filePath(): string {
    const dir = path.join(app.getPath("userData"), "secrets");
    fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, "device-identity.json");
  }

  loadOrCreate(): StoredIdentity {
    if (this.cache) return this.cache;
    if (fs.existsSync(this.filePath)) {
      this.cache = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
      return this.cache!;
    }
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error("SAFE_STORAGE_UNAVAILABLE");
    }

    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const privatePem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const encrypted = safeStorage.encryptString(privatePem);
    const stored: StoredIdentity = {
      installationId: randomUUID(),
      publicKeyPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
      encryptedPrivateKeyBase64: encrypted.toString("base64")
    };
    fs.writeFileSync(this.filePath, JSON.stringify(stored, null, 2), { mode: 0o600 });
    this.cache = stored;
    return stored;
  }

  get installationId(): string {
    return this.loadOrCreate().installationId;
  }

  get publicKeyPem(): string {
    return this.loadOrCreate().publicKeyPem;
  }

  signCanonical(value: string): string {
    const stored = this.loadOrCreate();
    const pem = safeStorage.decryptString(Buffer.from(stored.encryptedPrivateKeyBase64, "base64"));
    const key = createPrivateKey(pem);
    return sign(null, Buffer.from(value, "utf8"), key).toString("base64");
  }
}
