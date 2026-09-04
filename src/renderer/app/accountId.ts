import type { AppSnapshot } from "../../shared/ipc";

/** Renderer-side guard — main still re-validates; never omit accountId on live IPC. */
export function requireFocusedAccountId(snapshot: AppSnapshot): string {
  const id = snapshot.focusedAccountId?.trim();
  if (!id) throw new Error("ACCOUNT_ID_REQUIRED");
  return id;
}

export function requireApprovalAccountId(
  item: { accountId?: string },
  snapshot: AppSnapshot
): string {
  const fromItem = item.accountId?.trim();
  if (fromItem) return fromItem;
  return requireFocusedAccountId(snapshot);
}
