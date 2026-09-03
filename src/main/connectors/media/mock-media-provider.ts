import type { RuntimeHealth } from "../../../shared/live-types";
import type { MediaProvider } from "./types";

export class MockMediaProvider implements MediaProvider {
  async health(): Promise<RuntimeHealth> {
    return {
      component: "media:mock",
      status: "OK",
      message: "No avatar/TTS connected yet",
      checkedAt: new Date().toISOString()
    };
  }
  async speak(text: string): Promise<void> {
    console.info("[mock-media:speak]", text);
  }
  async stopSpeech(): Promise<void> {
    console.info("[mock-media:stop]");
  }
  async setScene(scene: string): Promise<void> {
    console.info("[mock-media:scene]", scene);
  }
}
