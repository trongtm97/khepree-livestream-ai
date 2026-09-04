/**
 * NDJSON stdin/stdout client for media_audio_bridge.exe (NAudio/WASAPI helper).
 * No business logic — enumerate / play / stop / health only.
 */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import type { AudioDeviceInfo } from "../../../../shared/media-contracts";
import type { RuntimeHealth } from "../../../../shared/live-types";

export type AudioBridgeRequest = {
  id?: string;
  command: "list_devices" | "play" | "stop" | "health" | "quit";
  deviceId?: string;
  filePath?: string;
};

export type AudioBridgeResponse = {
  id?: string;
  ok: boolean;
  error?: string;
  devices?: AudioDeviceInfo[];
  status?: RuntimeHealth["status"];
  message?: string;
  devicePresent?: boolean;
};

export interface AudioBridgeClient {
  listDevices(): Promise<AudioDeviceInfo[]>;
  play(deviceId: string, filePath: string): Promise<void>;
  stop(deviceId?: string): Promise<void>;
  health(deviceId: string): Promise<{
    status: RuntimeHealth["status"];
    message: string;
    devicePresent: boolean;
  }>;
  dispose(): Promise<void>;
}

let reqSeq = 0;

function nextId(): string {
  reqSeq += 1;
  return `r${reqSeq}`;
}

/** Resolve packaged or dev path to media_audio_bridge.exe. */
export function resolveAudioBridgeExe(appRoot: string): string | undefined {
  const candidates = [
    path.join(appRoot, "workers", "media_audio_bridge", "bin", "media_audio_bridge.exe"),
    path.join(appRoot, "workers", "media_audio_bridge", "media_audio_bridge.exe"),
    path.join(appRoot, "bin", "media_audio_bridge.exe")
  ];
  return candidates.find((p) => fs.existsSync(p));
}

/**
 * Long-lived bridge process. One instance per WindowsEndpointOutput so
 * concurrent accounts never share a blocking play call.
 */
export class StdioAudioBridge implements AudioBridgeClient {
  private child: ChildProcessWithoutNullStreams | undefined;
  private rl: readline.Interface | undefined;
  private pending = new Map<
    string,
    { resolve: (v: AudioBridgeResponse) => void; reject: (e: Error) => void }
  >();
  private starting: Promise<void> | undefined;
  private disposed = false;

  constructor(private readonly exePath: string) {}

  private async ensure(): Promise<void> {
    if (this.disposed) throw new Error("AUDIO_BRIDGE_DISPOSED");
    if (this.child && !this.child.killed) return;
    if (this.starting) return this.starting;
    this.starting = new Promise<void>((resolve, reject) => {
      try {
        const child = spawn(this.exePath, [], {
          stdio: ["pipe", "pipe", "pipe"],
          windowsHide: true
        });
        this.child = child;
        this.rl = readline.createInterface({ input: child.stdout });
        this.rl.on("line", (line) => this.onLine(line));
        child.stderr.on("data", () => {
          /* bridge logs stay in stderr; ignore for protocol */
        });
        child.on("error", (err) => {
          this.failAll(err instanceof Error ? err : new Error(String(err)));
          reject(err);
        });
        child.on("exit", () => {
          this.failAll(new Error("AUDIO_BRIDGE_EXITED"));
          this.child = undefined;
          this.rl?.close();
          this.rl = undefined;
        });
        // Ready immediately — first request will prove liveness.
        resolve();
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      } finally {
        this.starting = undefined;
      }
    });
    return this.starting;
  }

  private onLine(line: string): void {
    const trimmed = line.trim();
    if (!trimmed) return;
    let parsed: AudioBridgeResponse;
    try {
      parsed = JSON.parse(trimmed) as AudioBridgeResponse;
    } catch {
      return;
    }
    const id = parsed.id;
    if (!id) return;
    const wait = this.pending.get(id);
    if (!wait) return;
    this.pending.delete(id);
    wait.resolve(parsed);
  }

  private failAll(err: Error): void {
    for (const [, wait] of this.pending) {
      // Interrupted play/stop is success for the caller that requested stop.
      if (err.message === "AUDIO_BRIDGE_STOPPED" || err.message === "AUDIO_BRIDGE_DISPOSED") {
        wait.resolve({ ok: true, id: undefined });
      } else {
        wait.reject(err);
      }
    }
    this.pending.clear();
  }

  private request(body: AudioBridgeRequest): Promise<AudioBridgeResponse> {
    return new Promise((resolve, reject) => {
      void this.ensure()
        .then(() => {
          if (!this.child?.stdin.writable) {
            reject(new Error("AUDIO_BRIDGE_NOT_WRITABLE"));
            return;
          }
          const id = body.id ?? nextId();
          const payload = { ...body, id };
          this.pending.set(id, { resolve, reject });
          this.child.stdin.write(`${JSON.stringify(payload)}\n`, (err) => {
            if (err) {
              this.pending.delete(id);
              reject(err);
            }
          });
        })
        .catch(reject);
    });
  }

  async listDevices(): Promise<AudioDeviceInfo[]> {
    const res = await this.request({ command: "list_devices" });
    if (!res.ok) throw new Error(res.error ?? "AUDIO_BRIDGE_LIST_FAILED");
    return res.devices ?? [];
  }

  async play(deviceId: string, filePath: string): Promise<void> {
    const res = await this.request({ command: "play", deviceId, filePath });
    if (!res.ok) throw new Error(res.error ?? "AUDIO_BRIDGE_PLAY_FAILED");
  }

  async stop(deviceId?: string): Promise<void> {
    // Play blocks the bridge Main loop — cannot rely on a stop JSON while playing.
    // Kill the process (LocalPreview pattern); next play() respawns.
    void deviceId;
    const child = this.child;
    this.child = undefined;
    this.rl?.close();
    this.rl = undefined;
    this.failAll(new Error("AUDIO_BRIDGE_STOPPED"));
    if (child?.pid) {
      try {
        child.kill();
      } catch {
        /* ignore */
      }
    }
  }

  async health(deviceId: string): Promise<{
    status: RuntimeHealth["status"];
    message: string;
    devicePresent: boolean;
  }> {
    const res = await this.request({ command: "health", deviceId });
    if (!res.ok) {
      return {
        status: "DOWN",
        message: res.error ?? "AUDIO_BRIDGE_HEALTH_FAILED",
        devicePresent: false
      };
    }
    return {
      status: res.status ?? (res.devicePresent === false ? "DOWN" : "OK"),
      message: res.message ?? "ok",
      devicePresent: res.devicePresent !== false
    };
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    try {
      if (this.child?.stdin.writable) {
        this.child.stdin.write(`${JSON.stringify({ id: nextId(), command: "quit" })}\n`);
      }
    } catch {
      /* ignore */
    }
    const child = this.child;
    this.child = undefined;
    this.rl?.close();
    this.rl = undefined;
    this.failAll(new Error("AUDIO_BRIDGE_DISPOSED"));
    if (child?.pid) {
      try {
        child.kill();
      } catch {
        /* ignore */
      }
    }
  }
}

/** One-shot list_devices without keeping a process (UI picker). */
export async function listAudioDevicesOnce(
  exePath: string
): Promise<AudioDeviceInfo[]> {
  const bridge = new StdioAudioBridge(exePath);
  try {
    return await bridge.listDevices();
  } finally {
    await bridge.dispose();
  }
}

/**
 * In-memory bridge for tests — per-device play tracking, no Windows.
 * Simulates device disappearance via removeDevice().
 */
export class MockAudioBridge implements AudioBridgeClient {
  readonly devices = new Map<string, AudioDeviceInfo>();
  /** deviceId → list of played file paths */
  readonly plays = new Map<string, string[]>();
  private playing = new Map<string, { resolve: () => void }>();
  delayMs = 5;

  addDevice(id: string, name: string, state: AudioDeviceInfo["state"] = "ACTIVE"): void {
    this.devices.set(id, { id, name, state, isDefault: false });
  }

  removeDevice(id: string): void {
    this.devices.delete(id);
  }

  async listDevices(): Promise<AudioDeviceInfo[]> {
    return [...this.devices.values()];
  }

  async play(deviceId: string, filePath: string): Promise<void> {
    const d = this.devices.get(deviceId);
    if (!d || d.state !== "ACTIVE") {
      throw new Error(`AUDIO_DEVICE_GONE:${deviceId}`);
    }
    const list = this.plays.get(deviceId) ?? [];
    list.push(filePath);
    this.plays.set(deviceId, list);
    await new Promise<void>((resolve) => {
      this.playing.set(deviceId, { resolve });
      setTimeout(() => {
        const cur = this.playing.get(deviceId);
        if (cur?.resolve === resolve) this.playing.delete(deviceId);
        resolve();
      }, this.delayMs);
    });
  }

  async stop(deviceId?: string): Promise<void> {
    if (deviceId) {
      this.playing.get(deviceId)?.resolve();
      this.playing.delete(deviceId);
      return;
    }
    for (const [, w] of this.playing) w.resolve();
    this.playing.clear();
  }

  async health(deviceId: string): Promise<{
    status: RuntimeHealth["status"];
    message: string;
    devicePresent: boolean;
  }> {
    const d = this.devices.get(deviceId);
    if (!d || d.state !== "ACTIVE") {
      return {
        status: "DOWN",
        message: `Endpoint missing: ${deviceId}`,
        devicePresent: false
      };
    }
    return { status: "OK", message: d.name, devicePresent: true };
  }

  async dispose(): Promise<void> {
    await this.stop();
  }
}
