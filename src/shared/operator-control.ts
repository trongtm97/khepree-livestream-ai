/** Operator vs AI control modes — human always wins. */

export type OperatorControlMode =
  | "AI_ACTIVE"
  | "HUMAN_TAKEOVER"
  | "PAUSED"
  | "EMERGENCY_STOP";

export type OperatorControlAccountState = {
  accountId: string;
  mode: OperatorControlMode;
  since: string;
};

export type OperatorControlPublicSnapshot = {
  byAccount: Record<string, OperatorControlAccountState>;
  emergencyStop: boolean;
  /** Electron accelerator-style key, default F8. App-local only. */
  takeoverHotkey: string;
};

export const DEFAULT_TAKEOVER_HOTKEY = "F8";

/** True when AI must not speak / auto-approve for this account. */
export function isOperatorMuted(mode: OperatorControlMode): boolean {
  return mode === "HUMAN_TAKEOVER" || mode === "PAUSED" || mode === "EMERGENCY_STOP";
}
