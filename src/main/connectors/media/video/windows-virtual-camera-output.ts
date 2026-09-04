/**
 * Future Windows virtual-camera provider (UnityCapture / custom DShow / etc.).
 * Stub only — does not install drivers or claim multi-cam works.
 * See docs/VIRTUAL_CAMERA_FEASIBILITY.md and spikes/unitycapture-bridge/.
 */
import type { RuntimeHealth } from "../../../../shared/live-types";
import type {
  VideoFrameFormat,
  VideoFramePayload,
  VideoOutputInfo,
  VideoOutputProvider,
  VideoTargetInfo
} from "./types";

export class WindowsVirtualCameraOutput implements VideoOutputProvider {
  readonly id: string;
  readonly kind = "windows-virtual-camera" as const;
  private readonly accountId: string;

  constructor(opts: { accountId: string; id?: string }) {
    this.accountId = opts.accountId;
    this.id = opts.id ?? `win-vcam-${opts.accountId.slice(0, 8)}`;
  }

  async health(): Promise<RuntimeHealth> {
    return {
      component: `video:${this.id}`,
      status: "DISABLED",
      message: `WindowsVirtualCameraOutput not implemented for ${this.accountId.slice(0, 8)} — bridge spike required before claiming multi-cam`,
      checkedAt: new Date().toISOString()
    };
  }

  async listTargets(): Promise<VideoTargetInfo[]> {
    // Names reserved for future InstallMultipleDevices mapping — not live devices.
    return [
      {
        id: "win-vcam:khepree-1",
        name: "Camera Khepree 1",
        kind: "windows-virtual-camera"
      },
      {
        id: "win-vcam:khepree-2",
        name: "Camera Khepree 2",
        kind: "windows-virtual-camera"
      }
    ];
  }

  async open(_targetId: string, _format: VideoFrameFormat): Promise<void> {
    throw new Error("WINDOWS_VIRTUAL_CAMERA_NOT_IMPLEMENTED");
  }

  async pushFrame(_frame: VideoFramePayload): Promise<void> {
    throw new Error("WINDOWS_VIRTUAL_CAMERA_NOT_IMPLEMENTED");
  }

  async start(): Promise<void> {
    /* no-op until bridge exists */
  }

  async stop(): Promise<void> {
    /* no-op */
  }

  async getOutputInfo(): Promise<VideoOutputInfo> {
    return {
      kind: "windows-virtual-camera",
      label: "Windows virtual camera (not ready)"
    };
  }

  async dispose(): Promise<void> {
    await this.stop();
  }
}
