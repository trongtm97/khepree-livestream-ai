/**
 * Route WAV to a specific Windows render endpoint via media_audio_bridge.
 * Never falls back to the default speaker when the endpoint is gone.
 */
import type { RuntimeHealth } from "../../../../shared/live-types";
import type { AudioBridgeClient } from "./windows-audio-bridge";
import type { AudioOutput } from "./types";

function nowIso(): string {
  return new Date().toISOString();
}

export class WindowsEndpointOutput implements AudioOutput {
  readonly id: string;
  readonly displayName: string;
  readonly kind = "windows-endpoint" as const;
  private disposed = false;

  constructor(
    private readonly deviceId: string,
    private readonly bridge: AudioBridgeClient,
    displayName?: string
  ) {
    this.id = `windows-endpoint:${deviceId}`;
    this.displayName = displayName ?? deviceId;
  }

  get deviceEndpointId(): string {
    return this.deviceId;
  }

  async health(): Promise<RuntimeHealth> {
    if (!this.deviceId) {
      return {
        component: this.id,
        status: "DOWN",
        message: "No audio endpoint configured",
        checkedAt: nowIso()
      };
    }
    try {
      const h = await this.bridge.health(this.deviceId);
      return {
        component: this.id,
        status: h.devicePresent ? h.status : "DOWN",
        message: h.devicePresent
          ? h.message
          : "Thiết bị âm thanh đã mất — không chuyển về loa máy",
        checkedAt: nowIso()
      };
    } catch (err) {
      return {
        component: this.id,
        status: "DOWN",
        message: err instanceof Error ? err.message : String(err),
        checkedAt: nowIso()
      };
    }
  }

  async play(filePath: string): Promise<void> {
    if (this.disposed) throw new Error("AUDIO_DISPOSED");
    if (!this.deviceId) throw new Error("AUDIO_DEVICE_NOT_CONFIGURED");
    const h = await this.bridge.health(this.deviceId);
    if (!h.devicePresent || h.status === "DOWN") {
      // Fail closed — never route to default speakers.
      throw new Error(`AUDIO_DEVICE_GONE:${this.deviceId}`);
    }
    await this.bridge.play(this.deviceId, filePath);
  }

  async stop(): Promise<void> {
    if (!this.deviceId) return;
    try {
      await this.bridge.stop(this.deviceId);
    } catch {
      /* ignore stop errors */
    }
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    await this.stop();
    await this.bridge.dispose();
  }
}

/** Configured for windows-endpoint but missing device id — refuse speakers. */
export class UnconfiguredEndpointOutput implements AudioOutput {
  readonly id = "windows-endpoint:unconfigured";
  readonly displayName = "Unconfigured endpoint";
  readonly kind = "windows-endpoint" as const;

  async health(): Promise<RuntimeHealth> {
    return {
      component: this.id,
      status: "DOWN",
      message: "Chưa chọn thiết bị âm thanh livestream",
      checkedAt: nowIso()
    };
  }

  async play(): Promise<void> {
    throw new Error("AUDIO_DEVICE_NOT_CONFIGURED");
  }

  async stop(): Promise<void> {}
  async dispose(): Promise<void> {}
}
