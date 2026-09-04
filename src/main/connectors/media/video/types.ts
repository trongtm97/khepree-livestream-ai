/**
 * Video output providers — local preview / mock today; Windows virtual camera later.
 * Sales Brain never talks to these directly.
 */
import type { RuntimeHealth } from "../../../../shared/live-types";

export type VideoOutputKind =
  | "null"
  | "local-preview"
  | "mock"
  | "virtual-camera"
  | "windows-virtual-camera";

export type VideoPixelFormat = "rgba" | "bgra" | "nv12";

export type VideoFrameFormat = {
  width: number;
  height: number;
  pixelFormat: VideoPixelFormat;
  /** Target FPS hint (25/30 typical for TikTok vertical). */
  fps?: number;
};

/** Solid-color test pattern — used by mock dual-camera isolation tests. */
export type VideoTestPattern = {
  kind: "test-pattern";
  color: string;
  label: string;
};

export type VideoFramePayload = {
  width: number;
  height: number;
  pixelFormat: VideoPixelFormat;
  data: Uint8Array | Buffer | VideoTestPattern;
  timestampMs: number;
};

export type VideoTargetInfo = {
  id: string;
  /** Operator-visible name, e.g. "Camera Khepree 1". */
  name: string;
  kind: VideoOutputKind;
  reservedByAccountId?: string;
};

export type VideoOutputInfo = {
  kind: VideoOutputKind;
  label: string;
  deviceId?: string;
  targetId?: string;
};

/**
 * Pluggable video sink. Virtual camera implementations must stay optional /
 * externally installed — see docs/VIRTUAL_CAMERA_FEASIBILITY.md.
 */
export interface VideoOutputProvider {
  readonly id: string;
  readonly kind: VideoOutputKind;
  health(): Promise<RuntimeHealth>;
  listTargets(): Promise<VideoTargetInfo[]>;
  open(targetId: string, format: VideoFrameFormat): Promise<void>;
  pushFrame(frame: VideoFramePayload): Promise<void>;
  stop(): Promise<void>;
  dispose(): Promise<void>;
  /** Compat for MediaSession factory / health UI. */
  getOutputInfo(): Promise<VideoOutputInfo>;
  /** Arms default sink when no explicit open() yet (preview / null). */
  start(): Promise<void>;
}

/** @deprecated Prefer VideoOutputProvider — alias kept for existing MediaSession wiring. */
export type VideoOutput = VideoOutputProvider;
