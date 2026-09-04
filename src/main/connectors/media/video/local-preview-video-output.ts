/**
 * Local in-process preview sink — last frame for SceneEngine / UI.
 * Not a Windows camera device.
 */
import type { RuntimeHealth } from "../../../../shared/live-types";
import type {
  VideoFrameFormat,
  VideoFramePayload,
  VideoOutputInfo,
  VideoOutputProvider,
  VideoTargetInfo
} from "./types";

export class LocalPreviewVideoOutput implements VideoOutputProvider {
  readonly id: string;
  readonly kind = "local-preview" as const;
  private readonly accountId: string;
  private openTargetId: string | undefined;
  private format: VideoFrameFormat | undefined;
  private lastFrame: VideoFramePayload | undefined;
  private framesPushed = 0;

  constructor(opts: { id?: string; accountId: string }) {
    this.accountId = opts.accountId;
    this.id = opts.id ?? `local-preview-${opts.accountId.slice(0, 8)}`;
  }

  async health(): Promise<RuntimeHealth> {
    return {
      component: `video:${this.id}`,
      status: this.openTargetId ? "OK" : "DISABLED",
      message: this.openTargetId
        ? `Local preview · ${this.framesPushed} frames`
        : "Local preview idle",
      checkedAt: new Date().toISOString()
    };
  }

  async listTargets(): Promise<VideoTargetInfo[]> {
    return [
      {
        id: `local:${this.accountId}`,
        name: `Local preview (${this.accountId.slice(0, 8)})`,
        kind: "local-preview"
      }
    ];
  }

  async open(targetId: string, format: VideoFrameFormat): Promise<void> {
    const targets = await this.listTargets();
    if (!targets.some((t) => t.id === targetId)) {
      throw new Error(`VIDEO_TARGET_UNKNOWN:${targetId}`);
    }
    this.openTargetId = targetId;
    this.format = format;
  }

  async pushFrame(frame: VideoFramePayload): Promise<void> {
    if (!this.openTargetId) throw new Error("VIDEO_NOT_OPEN");
    this.lastFrame = frame;
    this.framesPushed += 1;
  }

  getLastFrame(): VideoFramePayload | undefined {
    return this.lastFrame;
  }

  async start(): Promise<void> {
    const [t] = await this.listTargets();
    if (!t) return;
    await this.open(t.id, this.format ?? { width: 720, height: 1280, pixelFormat: "rgba", fps: 25 });
  }

  async stop(): Promise<void> {
    this.openTargetId = undefined;
  }

  async getOutputInfo(): Promise<VideoOutputInfo> {
    return {
      kind: "local-preview",
      label: "Local preview",
      targetId: this.openTargetId
    };
  }

  async dispose(): Promise<void> {
    await this.stop();
    this.lastFrame = undefined;
  }
}
