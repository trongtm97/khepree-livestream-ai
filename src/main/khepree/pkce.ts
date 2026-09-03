import { createHash, randomBytes } from "node:crypto";

function b64url(input: Buffer): string {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export interface PkceTransaction {
  verifier: string;
  challenge: string;
  state: string;
  createdAt: number;
}

export function createPkceTransaction(): PkceTransaction {
  const verifier = b64url(randomBytes(48));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  return {
    verifier,
    challenge,
    state: b64url(randomBytes(24)),
    createdAt: Date.now()
  };
}
