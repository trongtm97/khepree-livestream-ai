import type { TikTokAccountRepository } from "../db/repositories";

/**
 * Validate accountId from renderer IPC — never trust the renderer alone.
 * Returns trimmed id or throws ACCOUNT_ID_REQUIRED / TIKTOK_ACCOUNT_NOT_FOUND.
 */
export function requireValidAccountId(
  raw: unknown,
  accounts: TikTokAccountRepository
): string {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error("ACCOUNT_ID_REQUIRED");
  }
  const id = raw.trim();
  if (!accounts.get(id)) {
    throw new Error("TIKTOK_ACCOUNT_NOT_FOUND");
  }
  return id;
}
