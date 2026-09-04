/**
 * Local MuseTalk sidecar provider — spike, not production-ready without GPU benchmark.
 * Falls outside Sales Brain; CompositeMediaSession fans TTS WAV here.
 */
import type {
  AvatarEngineSettings,
  AvatarHealth,
  AvatarProfile,
  AvatarSession,
  MuseTalkMetrics
} from "../../../../shared/media-contracts";
import { normalizeAvatarEngine } from "../../../../shared/media-contracts";
import type {
  AvatarAudioInput,
  AvatarOutputInfo,
  AvatarProvider,
  AvatarStartSessionInput
} from "./types";
import { MuseTalkHttpClient } from "./musetalk-http-client";

function nowIso(): string {
  return new Date().toISOString();
}

export type MuseTalkLocalProviderOptions = {
  settings?: AvatarEngineSettings;
  /** Worker bearer token (main-process only; never renderer). */
  token?: string;
  fetchImpl?: typeof fetch;
};

export class MuseTalkLocalProvider implements AvatarProvider {
  readonly id = "musetalk-local" as const;
  private readonly settings: AvatarEngineSettings;
  private readonly token: string;
  private readonly fetchImpl?: typeof fetch;
  private client: MuseTalkHttpClient | undefined;
  private profile: AvatarProfile | undefined;
  private session: AvatarSession | undefined;
  private disposed = false;
  private lastMetrics: MuseTalkMetrics | undefined;

  constructor(opts?: MuseTalkLocalProviderOptions) {
    this.settings = normalizeAvatarEngine(
      opts?.settings ?? { kind: "musetalk-local" }
    );
    this.token = (opts?.token ?? process.env.KHEPREE_MUSETALK_TOKEN ?? "").trim();
    this.fetchImpl = opts?.fetchImpl;
  }

  getSettings(): AvatarEngineSettings {
    return { ...this.settings };
  }

  getLastMetrics(): MuseTalkMetrics | undefined {
    return this.lastMetrics;
  }

  private ensureClient(): MuseTalkHttpClient {
    const url = this.settings.serverUrl?.trim();
    if (!url) throw new Error("MUSETALK_SERVER_MISSING");
    if (!this.client) {
      this.client = new MuseTalkHttpClient({
        serverUrl: url,
        token: this.token,
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
    if (this.settings.kind !== "musetalk-local" || !this.settings.serverUrl) {
      return {
        status: "DOWN",
        message: "MuseTalk local not configured",
        checkedAt: nowIso()
      };
    }
    try {
      const h = await this.ensureClient().health();
      if (h.metrics) this.lastMetrics = h.metrics;
      const status =
        h.status === "READY" || h.status === "LOADING" || h.status === "DEGRADED" || h.status === "DOWN"
          ? h.status
          : "DOWN";
      // Below realtime → DEGRADED; callers treat as avatar not ready for AVATAR_* modes.
      return {
        status,
        message: h.message ?? status,
        checkedAt: h.checkedAt ?? nowIso()
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
    const client = this.ensureClient();
    const modelDir = this.settings.modelDir;
    const sourceVideoPath = this.settings.sourceVideoPath ?? profile.sourceAssetPath;
    const avatarId = this.settings.avatarId ?? profile.id;
    if (!modelDir || !sourceVideoPath) {
      throw new Error("MUSETALK_INIT_PATHS_MISSING");
    }
    await client.initialize({
      modelDir,
      cacheDir: this.settings.cacheDir,
      avatarId,
      sourceVideoPath,
      forcePreprocess: false
    });
    this.profile = profile;
  }

  async startSession(input: AvatarStartSessionInput): Promise<AvatarSession> {
    if (this.disposed) throw new Error("AVATAR_DISPOSED");
    const client = this.ensureClient();
    const avatarId = this.settings.avatarId ?? this.profile?.id;
    if (!avatarId) throw new Error("MUSETALK_AVATAR_ID_MISSING");
    if (!this.profile) {
      await this.initialize({
        id: avatarId,
        name: avatarId,
        providerId: "musetalk-local",
        sourceAssetPath: this.settings.sourceVideoPath ?? "",
        modelConfig: { modelDir: this.settings.modelDir },
        createdAt: nowIso(),
        updatedAt: nowIso()
      });
    }
    const started = await client.startSession({
      accountId: input.accountId,
      sessionId: input.sessionId,
      avatarId
    });
    this.session = {
      accountId: input.accountId,
      sessionId: input.sessionId,
      providerSessionId: started.providerSessionId,
      status: "idle"
    };
    return { ...this.session };
  }

  async pushAudio(audio: AvatarAudioInput): Promise<void> {
    if (!this.session) throw new Error("AVATAR_NO_SESSION");
    this.session.status = "speaking";
    try {
      await this.ensureClient().pushAudio(this.session.providerSessionId, audio.path);
    } finally {
      if (this.session) this.session.status = "idle";
    }
  }

  async setIdle(): Promise<void> {
    if (this.session) this.session.status = "idle";
  }

  async setGesture(_gesture: string): Promise<void> {
    /* spike: no gesture API yet */
  }

  async interrupt(): Promise<void> {
    if (this.session) this.session.status = "idle";
  }

  async getOutputInfo(): Promise<AvatarOutputInfo> {
    return {
      kind: "preview-texture",
      label: "MuseTalk local (spike)",
      endpointId: this.session?.providerSessionId ?? this.settings.serverUrl
    };
  }

  async stopSession(): Promise<void> {
    if (this.session) {
      try {
        await this.ensureClient().stopSession(this.session.providerSessionId);
      } catch {
        /* best-effort */
      }
      this.session.status = "stopped";
      this.session = undefined;
    }
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    await this.stopSession();
    this.client = undefined;
  }
}
