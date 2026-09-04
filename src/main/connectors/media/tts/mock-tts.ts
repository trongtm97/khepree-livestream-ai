/**
 * Mock TTS — no audio files; used in CI / unit tests.
 */
import type { RuntimeHealth } from "../../../../shared/live-types";
import type { TtsVoiceInfo } from "../../../../shared/media-contracts";
import type { TtsProvider, TtsSynthesizeInput, TtsSynthesizeResult } from "./types";
import fs from "node:fs";

export class MockTtsProvider implements TtsProvider {
  readonly id = "mock" as const;
  readonly spoken: string[] = [];
  voices: TtsVoiceInfo[] = [
    { id: "mock-a", name: "Mock Voice A", locale: "vi-VN" },
    { id: "mock-b", name: "Mock Voice B", locale: "en-US" }
  ];
  /** Delay per speak to simulate synthesis (ms). */
  delayMs = 5;
  private cancelled = false;

  async health(): Promise<RuntimeHealth> {
    return {
      component: "tts:mock",
      status: "OK",
      message: "Mock TTS",
      checkedAt: new Date().toISOString()
    };
  }

  async listVoices(): Promise<TtsVoiceInfo[]> {
    return [...this.voices];
  }

  async synthesize(input: TtsSynthesizeInput): Promise<TtsSynthesizeResult> {
    this.cancelled = false;
    this.spoken.push(input.text);
    await new Promise((r) => setTimeout(r, this.delayMs));
    if (this.cancelled) throw new Error("TTS_CANCELLED");
    // Minimal valid-ish empty wav header so callers can "play" a file.
    const header = Buffer.alloc(44);
    header.write("RIFF", 0);
    header.writeUInt32LE(36, 4);
    header.write("WAVE", 8);
    header.write("fmt ", 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(1, 22);
    header.writeUInt32LE(8000, 24);
    header.writeUInt32LE(8000, 28);
    header.writeUInt16LE(1, 32);
    header.writeUInt16LE(8, 34);
    header.write("data", 36);
    header.writeUInt32LE(0, 40);
    fs.writeFileSync(input.outPath, header);
    return { path: input.outPath, format: "wav" };
  }

  async cancel(): Promise<void> {
    this.cancelled = true;
  }
}
