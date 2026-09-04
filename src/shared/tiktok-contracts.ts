import type { RuntimeHealth } from "./live-types";

export type TikTokConnectionPhase =
  | "DISCONNECTED"
  | "CONNECTING"
  | "CONNECTED"
  | "RECONNECTING"
  | "CONNECTOR_ERROR"
  | "DEPENDENCY_MISSING";

/** Public TikTok connector state for renderer — no secrets. */
export interface TikTokPublicState {
  phase: TikTokConnectionPhase;
  uniqueId?: string;
  connected: boolean;
  dependencyInstalled?: boolean;
  message?: string;
  lastCheckedAt?: string;
  connectedAt?: string;
  /** Total events published to the bus this session. */
  eventCount: number;
  /** Rolling comments-per-minute estimate. */
  commentsPerMinute: number;
  lastSequence: number;
  reconnectAttempt: number;
  nextRetryMs?: number;
}

/** Per-account TikTok connector snapshot — source of truth for multi-live UI. */
export interface AccountTikTokState {
  accountId: string;
  phase: TikTokConnectionPhase;
  connected: boolean;
  username?: string;
  connectedAt?: string;
  eventCount: number;
  commentsPerMinute: number;
  reconnectAttempt: number;
  health: RuntimeHealth;
  message?: string;
  lastCheckedAt?: string;
  dependencyInstalled?: boolean;
  nextRetryMs?: number;
}

export interface TikTokHealthDetail extends RuntimeHealth {
  phase: TikTokConnectionPhase;
  uniqueId?: string;
  connected: boolean;
  dependencyInstalled?: boolean;
}

export function emptyTikTokPublicState(): TikTokPublicState {
  return {
    phase: "DISCONNECTED",
    connected: false,
    eventCount: 0,
    commentsPerMinute: 0,
    lastSequence: 0,
    reconnectAttempt: 0
  };
}
