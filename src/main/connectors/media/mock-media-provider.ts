/**
 * Mock MediaSession for tests / self-checks — no speakers.
 * Keeps MockMediaProvider name for call-site compatibility.
 */
import type { RuntimeHealth } from "../../../shared/live-types";
import type { MediaSession, SpeakOptions } from "./types";

export class MockMediaProvider implements MediaSession {
  readonly accountId: string;
  sessionId?: string;
  readonly spoken: string[] = [];
  private scene = "default";
  private disposed = false;

  constructor(accountId = "mock") {
    this.accountId = accountId;
  }

  bindSession(sessionId: string | undefined): void {
    this.sessionId = sessionId;
  }

  async health(): Promise<RuntimeHealth> {
    return {
      component: "media:mock",
      status: "OK",
      message: "Mock media session (no TTS audio)",
      checkedAt: new Date().toISOString()
    };
  }

  async speak(text: string, _options?: SpeakOptions): Promise<void> {
    if (this.disposed) return;
    console.info("[mock-media:speak]", this.accountId, text);
    this.spoken.push(text);
  }

  async stopSpeech(): Promise<void> {
    console.info("[mock-media:stop]", this.accountId);
  }

  async setScene(scene: string): Promise<void> {
    this.scene = scene;
    console.info("[mock-media:scene]", this.accountId, scene);
  }

  async interrupt(): Promise<void> {
    await this.stopSpeech();
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    await this.stopSpeech();
  }
}
