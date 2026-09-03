import type { RuntimeHealth } from "../../../shared/live-types";

export interface MediaProvider {
  health(): Promise<RuntimeHealth>;
  speak(text: string): Promise<void>;
  stopSpeech(): Promise<void>;
  setScene(scene: string): Promise<void>;
}
