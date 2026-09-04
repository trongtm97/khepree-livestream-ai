/**
 * Avatar engine port — LiveTalking / MuseTalk / mock plug in here.
 * Sales Brain and LiveOrchestrator never import this; they use MediaSession only.
 */
import type {
  AvatarHealth,
  AvatarProfile,
  AvatarProviderId,
  AvatarSession
} from "../../../../shared/media-contracts";

/** Single TTS WAV shared with AudioOutput for lip-sync. */
export type AvatarAudioInput = {
  path: string;
  format: "wav";
};

export type AvatarStartSessionInput = {
  accountId: string;
  sessionId: string;
};

export type AvatarOutputInfo = {
  kind: "none" | "preview-texture" | "virtual-camera" | "external-stream";
  label: string;
  /** Opaque handle / device id when routing video. */
  endpointId?: string;
};

export interface AvatarProvider {
  readonly id: AvatarProviderId;
  health(): Promise<AvatarHealth>;
  initialize(profile: AvatarProfile): Promise<void>;
  startSession(input: AvatarStartSessionInput): Promise<AvatarSession>;
  pushAudio(audio: AvatarAudioInput): Promise<void>;
  setIdle(): Promise<void>;
  setGesture(gesture: string): Promise<void>;
  interrupt(): Promise<void>;
  getOutputInfo(): Promise<AvatarOutputInfo>;
  stopSession(): Promise<void>;
  dispose(): Promise<void>;
}

export function avatarHealthToRuntimeStatus(
  status: AvatarHealth["status"]
): "OK" | "DEGRADED" | "DOWN" {
  if (status === "READY") return "OK";
  if (status === "LOADING" || status === "DEGRADED") return "DEGRADED";
  return "DOWN";
}
