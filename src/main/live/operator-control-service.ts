/**
 * Per-account operator priority over AI speech / auto-approval.
 * Does not touch TikTok connect, browser sessions, or Khepree logout.
 */
import {
  DEFAULT_TAKEOVER_HOTKEY,
  isOperatorMuted,
  type OperatorControlAccountState,
  type OperatorControlMode,
  type OperatorControlPublicSnapshot
} from "../../shared/operator-control";

export type OperatorControlServiceOptions = {
  takeoverHotkey?: string;
  now?: () => number;
};

export class OperatorControlService {
  private readonly states = new Map<string, OperatorControlAccountState>();
  private emergencyStop = false;
  private takeoverHotkey: string;
  private readonly now: () => number;

  constructor(opts: OperatorControlServiceOptions = {}) {
    this.takeoverHotkey = normalizeHotkey(opts.takeoverHotkey ?? DEFAULT_TAKEOVER_HOTKEY);
    this.now = opts.now ?? (() => Date.now());
  }

  getHotkey(): string {
    return this.takeoverHotkey;
  }

  setHotkey(hotkey: string): void {
    this.takeoverHotkey = normalizeHotkey(hotkey);
  }

  isEmergency(): boolean {
    return this.emergencyStop;
  }

  getMode(accountId: string): OperatorControlMode {
    if (this.emergencyStop) return "EMERGENCY_STOP";
    return this.states.get(accountId)?.mode ?? "AI_ACTIVE";
  }

  getState(accountId: string): OperatorControlAccountState {
    const mode = this.getMode(accountId);
    const existing = this.states.get(accountId);
    if (existing && existing.mode === mode) return existing;
    return {
      accountId,
      mode,
      since: existing?.since ?? new Date(this.now()).toISOString()
    };
  }

  /** AI must not speak or auto-fire approvals. */
  isAiMuted(accountId: string): boolean {
    return isOperatorMuted(this.getMode(accountId));
  }

  enterTakeover(accountId: string): OperatorControlAccountState {
    this.emergencyStop = false;
    return this.setMode(accountId, "HUMAN_TAKEOVER");
  }

  /** Return control to AI — caller must discard stale speech/comments. */
  exitTakeover(accountId: string): OperatorControlAccountState {
    if (this.emergencyStop) {
      // Clearing one account does not lift global emergency.
      return this.setMode(accountId, "PAUSED");
    }
    return this.setMode(accountId, "AI_ACTIVE");
  }

  pause(accountId: string): OperatorControlAccountState {
    return this.setMode(accountId, "PAUSED");
  }

  /**
   * Global emergency: mute every known account; caller stops speech/countdowns.
   * Does not logout / disconnect TikTok / delete sessions.
   */
  emergencyStopAll(accountIds: string[]): OperatorControlPublicSnapshot {
    this.emergencyStop = true;
    const since = new Date(this.now()).toISOString();
    for (const id of accountIds) {
      this.states.set(id, { accountId: id, mode: "EMERGENCY_STOP", since });
    }
    return this.snapshot(accountIds);
  }

  /** Lift global emergency; accounts stay PAUSED until explicit resume. */
  clearEmergency(accountIds: string[]): OperatorControlPublicSnapshot {
    this.emergencyStop = false;
    const since = new Date(this.now()).toISOString();
    for (const id of accountIds) {
      this.states.set(id, { accountId: id, mode: "PAUSED", since });
    }
    return this.snapshot(accountIds);
  }

  resumeAi(accountId: string): OperatorControlAccountState {
    this.emergencyStop = false;
    return this.setMode(accountId, "AI_ACTIVE");
  }

  snapshot(accountIds: string[]): OperatorControlPublicSnapshot {
    const byAccount: Record<string, OperatorControlAccountState> = {};
    for (const id of accountIds) {
      byAccount[id] = this.getState(id);
    }
    return {
      byAccount,
      emergencyStop: this.emergencyStop,
      takeoverHotkey: this.takeoverHotkey
    };
  }

  private setMode(accountId: string, mode: OperatorControlMode): OperatorControlAccountState {
    const state: OperatorControlAccountState = {
      accountId,
      mode,
      since: new Date(this.now()).toISOString()
    };
    this.states.set(accountId, state);
    return state;
  }
}

function normalizeHotkey(raw: string): string {
  const t = raw.trim() || DEFAULT_TAKEOVER_HOTKEY;
  // Accept F8 / f8 / KeyF8 style → F8
  const m = /^f([1-9]|1[0-2])$/i.exec(t.replace(/^key/i, ""));
  if (m) return `F${m[1]}`;
  return t.length <= 24 ? t : DEFAULT_TAKEOVER_HOTKEY;
}
