/**
 * Per-account audio sink. Never silently fall back across accounts/devices.
 */
import type { RuntimeHealth } from "../../../../shared/live-types";

export type AudioOutputKind = "local-preview" | "windows-endpoint" | "mock";

export interface AudioOutput {
  readonly id: string;
  readonly displayName: string;
  readonly kind: AudioOutputKind;
  health(): Promise<RuntimeHealth>;
  play(filePath: string): Promise<void>;
  stop(): Promise<void>;
  dispose(): Promise<void>;
}
