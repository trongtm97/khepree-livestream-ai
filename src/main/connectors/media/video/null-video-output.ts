/**
 * No-op video sink — paths that do not route camera yet.
 */
import type { RuntimeHealth } from "../../../../shared/live-types";
import type {
  VideoFrameFormat,
  VideoFramePayload,
  VideoOutputInfo,
  VideoOutputProvider,
  VideoTargetInfo
} from "./types";

export class NullVideoOutput implements VideoOutputProvider {
  readonly id: string;
  readonly kind = "null" as const;
  private started = false;

  constructor(id = "video-null") {
    this.id = id;
  }

  async health(): Promise<RuntimeHealth> {
    return {
      component: `video:${this.id}`,
      status: "DISABLED",
      message: "No video route",
      checkedAt: new Date().toISOString()
    };
  }

  async listTargets(): Promise<VideoTargetInfo[]> {
    return [];
  }

  async open(_targetId: string, _format: VideoFrameFormat): Promise<void> {
    this.started = true;
  }

  async pushFrame(_frame: VideoFramePayload): Promise<void> {
    /* drop */
  }

  async start(): Promise<void> {
    this.started = true;
  }

  async stop(): Promise<void> {
    this.started = false;
  }

  async getOutputInfo(): Promise<VideoOutputInfo> {
    return { kind: "null", label: this.started ? "null (armed)" : "null" };
  }

  async dispose(): Promise<void> {
    await this.stop();
  }
}
