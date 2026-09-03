import type { LiveEvent, RuntimeHealth } from "../../../shared/live-types";

export interface TikTokProvider {
  health(): Promise<RuntimeHealth>;
  connect(uniqueId: string): Promise<void>;
  disconnect(): Promise<void>;
  drainEvents(afterSequence: number): Promise<LiveEvent[]>;
}
