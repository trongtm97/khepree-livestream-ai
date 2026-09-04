import { randomUUID } from "node:crypto";
import type { AutomationMode, TikTokAccount } from "./live-types";

/** Default automation mode for new account settings (AGENTS.md). */
export const DEFAULT_ACCOUNT_AUTOMATION_MODE: AutomationMode = "SUPERVISED_AUTO";

/**
 * Immutable filesystem-safe profile key.
 * Never derive from raw username — usernames change and may contain unsafe chars.
 */
export function createProfileKey(): string {
  return `tt_${randomUUID().replace(/-/g, "")}`;
}

export function isSafeProfileKey(key: string): boolean {
  return (
    key.length >= 8 &&
    key.length <= 80 &&
    /^[a-zA-Z0-9_-]+$/.test(key) &&
    !key.includes("..")
  );
}

export function assertSafeProfileKey(key: string): void {
  if (!isSafeProfileKey(key)) {
    throw new Error("INVALID_PROFILE_KEY");
  }
}

/** Normalize seller @handle the same way as TikTok connector uniqueId. */
export function normalizeTikTokUsername(raw: string): string {
  const trimmed = raw.trim().replace(/^@+/, "");
  if (!trimmed) return "";
  return `@${trimmed}`;
}

export function newTikTokAccountId(): string {
  return `acc_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

export type CreateTikTokAccountInput = {
  username: string;
  displayName?: string;
  label?: string;
  profileKey?: string;
  enabled?: boolean;
  id?: string;
};

export function buildTikTokAccount(input: CreateTikTokAccountInput): TikTokAccount {
  const username = normalizeTikTokUsername(input.username);
  if (!username || username === "@") {
    throw new Error("TIKTOK_USERNAME_REQUIRED");
  }
  const profileKey = input.profileKey ?? createProfileKey();
  assertSafeProfileKey(profileKey);
  const now = new Date().toISOString();
  return {
    id: input.id ?? newTikTokAccountId(),
    username,
    displayName: input.displayName?.trim() || undefined,
    label: input.label?.trim() || undefined,
    profileKey,
    enabled: input.enabled !== false,
    createdAt: now,
    updatedAt: now
  };
}

// ponytail: self-check for profile key + username normalize
export function assertTikTokAccountHelpers(): void {
  const key = createProfileKey();
  assertSafeProfileKey(key);
  if (isSafeProfileKey("../evil") || isSafeProfileKey("a/b") || isSafeProfileKey("")) {
    throw new Error("unsafe profile key accepted");
  }
  if (normalizeTikTokUsername("shop_a") !== "@shop_a") {
    throw new Error("username normalize broken");
  }
  if (normalizeTikTokUsername("@@shop_a") !== "@shop_a") {
    throw new Error("username double-@ normalize broken");
  }
  const acc = buildTikTokAccount({ username: "shop_b", label: "B" });
  if (!acc.id.startsWith("acc_") || acc.username !== "@shop_b" || !isSafeProfileKey(acc.profileKey)) {
    throw new Error("buildTikTokAccount broken");
  }
}
