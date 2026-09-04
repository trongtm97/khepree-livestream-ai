/**
 * In-memory mock virtual cameras for dual-feed isolation tests (no GPU / no driver).
 * Default targets: "Camera Khepree 1" / "Camera Khepree 2".
 */
import type { RuntimeHealth } from "../../../../shared/live-types";
import type {
  VideoFrameFormat,
  VideoFramePayload,
  VideoOutputInfo,
  VideoOutputProvider,
  VideoTargetInfo,
  VideoTestPattern
} from "./types";
import {
  defaultVideoDeviceReservations,
  type VideoDeviceReservationService
} from "./video-device-reservation";

export type MockCameraTarget = {
  id: string;
  name: string;
};

export const DEFAULT_MOCK_CAMERA_TARGETS: MockCameraTarget[] = [
  { id: "mock:khepree-1", name: "Camera Khepree 1" },
  { id: "mock:khepree-2", name: "Camera Khepree 2" }
];

/** Shared bus so a "receiving app" can read what was pushed to each mock device. */
const mockBuses = new Map<string, VideoFramePayload>();

export function readMockCameraFrame(targetId: string): VideoFramePayload | undefined {
  return mockBuses.get(targetId);
}

export function clearMockCameraBus(): void {
  mockBuses.clear();
}

export function isTestPattern(data: VideoFramePayload["data"]): data is VideoTestPattern {
  return typeof data === "object" && data !== null && "kind" in data && data.kind === "test-pattern";
}

export class MockVideoOutput implements VideoOutputProvider {
  readonly id: string;
  readonly kind = "mock" as const;
  private readonly accountId: string;
  private readonly targets: MockCameraTarget[];
  private readonly reservations: VideoDeviceReservationService;
  private openTargetId: string | undefined;
  private format: VideoFrameFormat | undefined;
  private framesPushed = 0;

  constructor(opts: {
    accountId: string;
    id?: string;
    targets?: MockCameraTarget[];
    reservations?: VideoDeviceReservationService;
  }) {
    this.accountId = opts.accountId;
    this.id = opts.id ?? `mock-video-${opts.accountId.slice(0, 8)}`;
    this.targets = opts.targets ?? DEFAULT_MOCK_CAMERA_TARGETS;
    this.reservations = opts.reservations ?? defaultVideoDeviceReservations;
  }

  async health(): Promise<RuntimeHealth> {
    return {
      component: `video:${this.id}`,
      status: this.openTargetId ? "OK" : "DISABLED",
      message: this.openTargetId
        ? `Mock cam ${this.openTargetId} · ${this.framesPushed} frames`
        : "Mock video idle",
      checkedAt: new Date().toISOString()
    };
  }

  async listTargets(): Promise<VideoTargetInfo[]> {
    return this.targets.map((t) => ({
      id: t.id,
      name: t.name,
      kind: "mock" as const,
      reservedByAccountId: this.reservations.holder(t.id)
    }));
  }

  async open(targetId: string, format: VideoFrameFormat): Promise<void> {
    if (!this.targets.some((t) => t.id === targetId)) {
      throw new Error(`VIDEO_TARGET_UNKNOWN:${targetId}`);
    }
    if (this.openTargetId && this.openTargetId !== targetId) {
      this.reservations.release(this.openTargetId, this.accountId);
    }
    this.reservations.claim(targetId, this.accountId);
    this.openTargetId = targetId;
    this.format = format;
  }

  async pushFrame(frame: VideoFramePayload): Promise<void> {
    if (!this.openTargetId) throw new Error("VIDEO_NOT_OPEN");
    mockBuses.set(this.openTargetId, frame);
    this.framesPushed += 1;
  }

  async start(): Promise<void> {
    /* Must open an explicit target — multi-account needs claim. */
  }

  async stop(): Promise<void> {
    if (this.openTargetId) {
      this.reservations.release(this.openTargetId, this.accountId);
      this.openTargetId = undefined;
    }
  }

  async getOutputInfo(): Promise<VideoOutputInfo> {
    const name = this.targets.find((t) => t.id === this.openTargetId)?.name;
    return {
      kind: "mock",
      label: name ?? "Mock video",
      deviceId: this.openTargetId,
      targetId: this.openTargetId
    };
  }

  async dispose(): Promise<void> {
    await this.stop();
    this.reservations.releaseAll(this.accountId);
  }
}
