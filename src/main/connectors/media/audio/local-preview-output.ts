/**
 * Play WAV on the local default speaker (operator preview).
 * Livestream routing uses WindowsEndpointOutput — never mix them silently.
 */
import { execFile } from "node:child_process";
import type { RuntimeHealth } from "../../../../shared/live-types";
import type { AudioOutput } from "./types";

function escapePs(s: string): string {
  return s.replace(/'/g, "''");
}

function nowIso(): string {
  return new Date().toISOString();
}

export class LocalPreviewOutput implements AudioOutput {
  readonly id = "local-preview";
  readonly displayName = "Local speakers";
  readonly kind = "local-preview" as const;
  private playProc: ReturnType<typeof execFile> | undefined;
  private stopped = false;

  async health(): Promise<RuntimeHealth> {
    return {
      component: "audio:local-preview",
      status: "OK",
      message: "Default speakers (preview)",
      checkedAt: nowIso()
    };
  }

  async play(filePath: string): Promise<void> {
    this.stopped = false;
    if (process.platform === "win32") {
      await this.playWindows(filePath);
      return;
    }
    // Non-Windows: no-op success so unit tests / Linux CI don't fail.
    await new Promise((r) => setTimeout(r, 1));
  }

  private playWindows(filePath: string): Promise<void> {
    const path = escapePs(filePath);
    const script = `
Add-Type -AssemblyName System.Media
$p = New-Object System.Media.SoundPlayer '${path}'
$p.PlaySync()
`.trim();
    return new Promise((resolve, reject) => {
      const child = execFile(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
        { windowsHide: true, timeout: 120_000 },
        (err) => {
          this.playProc = undefined;
          if (this.stopped) {
            resolve();
            return;
          }
          if (err) reject(err);
          else resolve();
        }
      );
      this.playProc = child;
    });
  }

  async stop(): Promise<void> {
    this.stopped = true;
    const child = this.playProc;
    this.playProc = undefined;
    if (child?.pid) {
      try {
        child.kill();
      } catch {
        /* ignore */
      }
    }
  }

  async dispose(): Promise<void> {
    await this.stop();
  }
}

/** Test double — records play calls, no speakers. */
export class MockAudioOutput implements AudioOutput {
  readonly id: string;
  readonly displayName: string;
  readonly kind = "mock" as const;
  readonly played: string[] = [];
  delayMs = 5;
  private stopped = false;
  private wait?: { resolve: () => void };
  private healthStatus: RuntimeHealth["status"] = "OK";
  private healthMessage = "mock ok";

  constructor(opts?: { id?: string; displayName?: string }) {
    this.id = opts?.id ?? "mock-audio";
    this.displayName = opts?.displayName ?? "Mock audio";
  }

  setHealth(status: RuntimeHealth["status"], message = "mock"): void {
    this.healthStatus = status;
    this.healthMessage = message;
  }

  async health(): Promise<RuntimeHealth> {
    return {
      component: `audio:${this.id}`,
      status: this.healthStatus,
      message: this.healthMessage,
      checkedAt: nowIso()
    };
  }

  async play(filePath: string): Promise<void> {
    if (this.healthStatus === "DOWN") {
      throw new Error(`AUDIO_DEVICE_DOWN:${this.id}`);
    }
    this.stopped = false;
    this.played.push(filePath);
    await new Promise<void>((resolve) => {
      this.wait = { resolve };
      setTimeout(() => {
        this.wait = undefined;
        resolve();
      }, this.delayMs);
    });
    if (this.stopped) return;
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.wait?.resolve();
    this.wait = undefined;
  }

  async dispose(): Promise<void> {
    await this.stop();
  }
}
