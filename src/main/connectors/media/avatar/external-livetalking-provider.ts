/**
 * Optional external LiveTalking adapter — HTTP only, no bundled models/GPU.
 * Khepree TTS WAV → POST /humanaudio. Never uses LiveTalking LLM/TTS as brain.
 */
import type {
  AvatarEngineSettings,
  AvatarHealth,
  AvatarProfile,
  AvatarSession
} from "../../../../shared/media-contracts";
import { normalizeAvatarEngine } from "../../../../shared/media-contracts";
import type {
  AvatarAudioInput,
  AvatarOutputInfo,
  AvatarProvider,
  AvatarStartSessionInput
} from "./types";
import {
  LiveTalkingHttpClient,
  type LiveTalkingHealthProbe
} from "./livetalking-http-client";

function nowIso(): string {
  return new Date().toISOString();
}

export type ExternalLiveTalkingOptions = {
  /** @deprecated Prefer settings.serverUrl */
  endpointUrl?: string;
  settings?: AvatarEngineSettings;
  fetchImpl?: typeof fetch;
};

export class ExternalLiveTalkingProvider implements AvatarProvider {
  readonly id = "external-livetalking" as const;
  private readonly settings: AvatarEngineSettings;
  private readonly fetchImpl?: typeof fetch;
  private client: LiveTalkingHttpClient | undefined;
  private profile: AvatarProfile | undefined;
  private session: AvatarSession | undefined;
  private disposed = false;
  private lastProbe: LiveTalkingHealthProbe | undefined;

  constructor(opts?: ExternalLiveTalkingOptions) {
    const fromLegacy =
      opts?.endpointUrl && !opts.settings
        ? normalizeAvatarEngine({
            kind: "livetalking",
            serverUrl: opts.endpointUrl
          })
        : undefined;
    this.settings = normalizeAvatarEngine(opts?.settings ?? fromLegacy);
    this.fetchImpl = opts?.fetchImpl;
  }

  getSettings(): AvatarEngineSettings {
    return { ...this.settings };
  }

  getProviderSessionId(): string | undefined {
    return this.session?.providerSessionId;
  }

  getLastProbe(): LiveTalkingHealthProbe | undefined {
    return this.lastProbe;
  }

  private ensureClient(): LiveTalkingHttpClient {
    const url = this.settings.serverUrl?.trim();
    const avatarId = this.settings.avatarId?.trim();
    if (!url || !avatarId) throw new Error("AVATAR_ENDPOINT_MISSING");
    if (!this.client) {
      this.client = new LiveTalkingHttpClient({
        serverUrl: url,
        avatarId,
        model: this.settings.model,
        transport: this.settings.transport,
        connectionTimeoutMs: this.settings.connectionTimeoutMs,
        fetchImpl: this.fetchImpl
      });
    }
    return this.client;
  }

  async health(): Promise<AvatarHealth> {
    if (this.disposed) {
      return { status: "DOWN", message: "disposed", checkedAt: nowIso() };
    }
    if (this.settings.kind !== "livetalking" || !this.settings.serverUrl || !this.settings.avatarId) {
      return {
        status: "DOWN",
        message: "LiveTalking not configured",
        checkedAt: nowIso()
      };
    }
    try {
      const client = this.ensureClient();
      this.lastProbe = await client.probe({
        sessionStarted: Boolean(this.session),
        outputAvailable: Boolean(this.session)
      });
      const p = this.lastProbe;
      if (!p.serverReachable) {
        return { status: "DOWN", message: p.message, checkedAt: p.checkedAt };
      }
      if (!p.avatarExists) {
        return { status: "DEGRADED", message: p.message, checkedAt: p.checkedAt };
      }
      if (!this.profile) {
        return {
          status: "LOADING",
          message: `reachable; avatar=${this.settings.avatarId}`,
          checkedAt: p.checkedAt
        };
      }
      if (this.session && p.audioAccepted && p.outputAvailable) {
        return { status: "READY", message: p.message, checkedAt: p.checkedAt };
      }
      if (this.session) {
        return {
          status: "READY",
          message: `session=${this.session.providerSessionId}`,
          checkedAt: p.checkedAt
        };
      }
      return {
        status: "DEGRADED",
        message: "server ok; session not started",
        checkedAt: p.checkedAt
      };
    } catch (err) {
      return {
        status: "DOWN",
        message: err instanceof Error ? err.message : String(err),
        checkedAt: nowIso()
      };
    }
  }

  async initialize(profile: AvatarProfile): Promise<void> {
    if (this.disposed) throw new Error("AVATAR_DISPOSED");
    this.ensureClient();
    this.profile = profile;
  }

  async startSession(input: AvatarStartSessionInput): Promise<AvatarSession> {
    if (this.disposed) throw new Error("AVATAR_DISPOSED");
    const client = this.ensureClient();
    if (!this.profile) {
      const id = this.settings.avatarId ?? "livetalking";
      this.profile = {
        id,
        name: id,
        providerId: "external-livetalking",
        sourceAssetPath: this.settings.serverUrl ?? "",
        modelConfig: {
          model: this.settings.model,
          transport: this.settings.transport
        },
        createdAt: nowIso(),
        updatedAt: nowIso()
      };
    }
    const offer = await client.offerSession();
    this.session = {
      accountId: input.accountId,
      sessionId: input.sessionId,
      providerSessionId: offer.sessionId,
      status: "idle"
    };
    return { ...this.session };
  }

  async pushAudio(audio: AvatarAudioInput): Promise<void> {
    if (!this.session) throw new Error("AVATAR_NO_SESSION");
    const client = this.ensureClient();
    this.session.status = "speaking";
    try {
      await client.pushAudioFile(this.session.providerSessionId, audio.path);
    } finally {
      if (this.session) this.session.status = "idle";
    }
  }

  async setIdle(): Promise<void> {
    if (this.session) this.session.status = "idle";
  }

  async setGesture(_gesture: string): Promise<void> {
    // ponytail: ceiling — map to LiveTalking /set_audiotype when choreography is wired.
  }

  async interrupt(): Promise<void> {
    if (!this.session) return;
    const client = this.ensureClient();
    try {
      await client.interrupt(this.session.providerSessionId);
    } catch {
      /* best-effort */
    }
    this.session.status = "idle";
  }

  async getOutputInfo(): Promise<AvatarOutputInfo> {
    const transport = this.settings.transport ?? "webrtc";
    return {
      kind:
        transport === "virtualcam"
          ? "virtual-camera"
          : this.settings.serverUrl
            ? "external-stream"
            : "none",
      label: `LiveTalking (${transport})`,
      endpointId: this.session?.providerSessionId ?? this.settings.serverUrl
    };
  }

  async stopSession(): Promise<void> {
    if (this.session) this.session.status = "stopped";
    this.session = undefined;
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    await this.stopSession();
    this.client = undefined;
  }
}
