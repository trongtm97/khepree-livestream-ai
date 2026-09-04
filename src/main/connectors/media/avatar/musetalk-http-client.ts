/**
 * HTTP client for workers/avatar_musetalk_worker (no PyTorch in Electron).
 */
import type { MuseTalkMetrics } from "../../../../shared/media-contracts";

export type MuseTalkClientOptions = {
  serverUrl: string;
  token?: string;
  connectionTimeoutMs?: number;
  fetchImpl?: typeof fetch;
};

export type MuseTalkHealthResponse = {
  status: string;
  message?: string;
  initialized?: boolean;
  productionReady?: boolean;
  metrics?: MuseTalkMetrics;
  checkedAt?: string;
};

function normalizeBase(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

export class MuseTalkHttpClient {
  readonly baseUrl: string;
  private readonly token: string;
  private readonly connectionTimeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: MuseTalkClientOptions) {
    this.baseUrl = normalizeBase(opts.serverUrl);
    this.token = (opts.token ?? "").trim();
    this.connectionTimeoutMs = opts.connectionTimeoutMs ?? 8_000;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  private headers(json = true): HeadersInit {
    const h: Record<string, string> = {};
    if (json) h["content-type"] = "application/json";
    if (this.token) h.authorization = `Bearer ${this.token}`;
    return h;
  }

  private signal(): AbortSignal {
    return AbortSignal.timeout(this.connectionTimeoutMs);
  }

  async health(): Promise<MuseTalkHealthResponse> {
    const res = await this.fetchImpl(`${this.baseUrl}/health`, {
      method: "GET",
      headers: this.headers(false),
      signal: this.signal()
    });
    if (!res.ok) throw new Error(`MUSETALK_HEALTH_HTTP_${res.status}`);
    return (await res.json()) as MuseTalkHealthResponse;
  }

  async initialize(body: {
    modelDir: string;
    cacheDir?: string;
    avatarId: string;
    sourceVideoPath: string;
    forcePreprocess?: boolean;
  }): Promise<{ ok: boolean; preprocess?: Record<string, unknown> }> {
    const res = await this.fetchImpl(`${this.baseUrl}/initialize`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
      signal: this.signal()
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`MUSETALK_INIT_HTTP_${res.status}:${detail}`);
    }
    return (await res.json()) as { ok: boolean; preprocess?: Record<string, unknown> };
  }

  async startSession(body: {
    accountId: string;
    sessionId: string;
    avatarId: string;
  }): Promise<{ providerSessionId: string }> {
    const res = await this.fetchImpl(`${this.baseUrl}/session/start`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
      signal: this.signal()
    });
    if (!res.ok) throw new Error(`MUSETALK_SESSION_START_HTTP_${res.status}`);
    const json = (await res.json()) as {
      session?: { providerSessionId?: string };
      providerSessionId?: string;
    };
    const id = json.session?.providerSessionId ?? json.providerSessionId;
    if (!id) throw new Error("MUSETALK_SESSION_NO_ID");
    return { providerSessionId: id };
  }

  async pushAudio(providerSessionId: string, audioPath: string): Promise<void> {
    const res = await this.fetchImpl(`${this.baseUrl}/session/audio`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ providerSessionId, audioPath }),
      signal: this.signal()
    });
    if (!res.ok) throw new Error(`MUSETALK_AUDIO_HTTP_${res.status}`);
  }

  async stopSession(providerSessionId: string): Promise<void> {
    const res = await this.fetchImpl(`${this.baseUrl}/session/stop`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ providerSessionId }),
      signal: this.signal()
    });
    if (!res.ok) throw new Error(`MUSETALK_STOP_HTTP_${res.status}`);
  }

  async metrics(): Promise<MuseTalkMetrics & { productionReady?: boolean }> {
    const res = await this.fetchImpl(`${this.baseUrl}/metrics`, {
      method: "GET",
      headers: this.headers(false),
      signal: this.signal()
    });
    if (!res.ok) throw new Error(`MUSETALK_METRICS_HTTP_${res.status}`);
    return (await res.json()) as MuseTalkMetrics & { productionReady?: boolean };
  }
}
