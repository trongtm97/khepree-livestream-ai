/**
 * In-process mock avatar — records pushAudio / gestures for isolation tests.
 */
import { randomUUID } from "node:crypto";
import type {
  AvatarHealth,
  AvatarProfile,
  AvatarSession
} from "../../../../shared/media-contracts";
import type {
  AvatarAudioInput,
  AvatarOutputInfo,
  AvatarProvider,
  AvatarStartSessionInput
} from "./types";

function nowIso(): string {
  return new Date().toISOString();
}

export class MockAvatarProvider implements AvatarProvider {
  readonly id = "mock" as const;
  readonly pushedAudio: string[] = [];
  readonly gestures: string[] = [];
  lastPushedPath: string | undefined;
  sessionStopped = false;
  status: AvatarHealth["status"] = "DOWN";
  private profile: AvatarProfile | undefined;
  private session: AvatarSession | undefined;
  private disposed = false;
  delayMs = 5;

  async health(): Promise<AvatarHealth> {
    return {
      status: this.disposed ? "DOWN" : this.status,
      message: this.profile ? `mock:${this.profile.id}` : "not initialized",
      checkedAt: nowIso()
    };
  }

  async initialize(profile: AvatarProfile): Promise<void> {
    if (this.disposed) throw new Error("AVATAR_DISPOSED");
    this.profile = profile;
    this.status = "READY";
  }

  async startSession(input: AvatarStartSessionInput): Promise<AvatarSession> {
    if (this.disposed) throw new Error("AVATAR_DISPOSED");
    if (!this.profile) throw new Error("AVATAR_NOT_INITIALIZED");
    this.sessionStopped = false;
    this.session = {
      accountId: input.accountId,
      sessionId: input.sessionId,
      providerSessionId: `mock_${randomUUID().slice(0, 8)}`,
      status: "idle"
    };
    this.status = "READY";
    return { ...this.session };
  }

  async pushAudio(audio: AvatarAudioInput): Promise<void> {
    if (this.disposed) throw new Error("AVATAR_DISPOSED");
    if (!this.session || this.sessionStopped) throw new Error("AVATAR_NO_SESSION");
    this.session.status = "speaking";
    this.pushedAudio.push(audio.path);
    this.lastPushedPath = audio.path;
    await new Promise((r) => setTimeout(r, this.delayMs));
    if (this.session) this.session.status = "idle";
  }

  async setIdle(): Promise<void> {
    if (this.session) this.session.status = "idle";
    this.gestures.push("idle");
  }

  async setGesture(gesture: string): Promise<void> {
    this.gestures.push(gesture || "idle");
  }

  async interrupt(): Promise<void> {
    if (this.session) this.session.status = "idle";
  }

  async getOutputInfo(): Promise<AvatarOutputInfo> {
    return {
      kind: "preview-texture",
      label: this.profile?.name ?? "Mock avatar",
      endpointId: this.profile?.id
    };
  }

  async stopSession(): Promise<void> {
    this.sessionStopped = true;
    if (this.session) this.session.status = "stopped";
    this.session = undefined;
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    await this.stopSession();
    this.status = "DOWN";
  }
}
