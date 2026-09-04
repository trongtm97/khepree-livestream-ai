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

export interface TikTokHealthDetail extends RuntimeHealth {
  phase: TikTokConnectionPhase;
  uniqueId?: string;
  connected: boolean;
  dependencyInstalled?: boolean;
}
