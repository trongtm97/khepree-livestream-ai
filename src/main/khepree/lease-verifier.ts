import { createPublicKey, verify } from "node:crypto";
import type { SignedLease } from "../../shared/khepree-contracts";

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(",")}}`;
}

export function verifyLease(
  lease: SignedLease,
  opts: {
    publicKeyPem: string;
    expectedKeyId: string;
    expectedProductSlug: string;
    expectedDeviceId?: string;
    nowSeconds?: number;
    /** Packaged builds must verify; unpackaged may skip when key not configured yet. */
    requireSignature?: boolean;
  }
): void {
  const requireSignature = opts.requireSignature ?? true;
  if (requireSignature && !opts.publicKeyPem) throw new Error("KHEPREE_SIGNING_KEY_MISSING");
  if (opts.publicKeyPem && lease.keyId !== opts.expectedKeyId) throw new Error("LEASE_KEY_ID_MISMATCH");
  if (lease.payload.productSlug !== opts.expectedProductSlug) throw new Error("LEASE_PRODUCT_MISMATCH");
  if (opts.expectedDeviceId && lease.payload.deviceId !== opts.expectedDeviceId) {
    throw new Error("LEASE_DEVICE_MISMATCH");
  }

  const now = opts.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (lease.payload.iat > now + 300) throw new Error("LEASE_IAT_IN_FUTURE");
  if (lease.payload.exp <= now) throw new Error("LEASE_EXPIRED");

  if (!opts.publicKeyPem) return;

  const key = createPublicKey(opts.publicKeyPem);
  const ok = verify(
    null,
    Buffer.from(canonicalJson(lease.payload), "utf8"),
    key,
    Buffer.from(lease.signature, "base64")
  );
  if (!ok) throw new Error("LEASE_SIGNATURE_INVALID");
}
