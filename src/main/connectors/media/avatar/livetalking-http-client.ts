/**
 * Minimal HTTP client for an external LiveTalking server (Apache-2.0 upstream).
 * No model download; no in-process GPU. Spike uses /offer + /humanaudio only.
 */
import fs from "node:fs";
import path from "node:path";
import type { LiveTalkingTransport } from "../../../../shared/media-contracts";

export type LiveTalkingClientOptions = {
  serverUrl: string;
  avatarId: string;
  model?: string;
  transport?: LiveTalkingTransport;
  connectionTimeoutMs?: number;
  /** Inject fetch for tests. */
  fetchImpl?: typeof fetch;
};

export type LiveTalkingOfferResult = {
  sessionId: string;
  answerSdp?: string;
};

export type LiveTalkingHealthProbe = {
  serverReachable: boolean;
  avatarExists: boolean;
  sessionStarted: boolean;
  audioAccepted: boolean;
  outputAvailable: boolean;
  message: string;
  checkedAt: string;
};

/** Tiny SDP so /offer can allocate a sessionid without embedding a full WebRTC stack. */
export const MINIMAL_WEBRTC_OFFER_SDP = [
  "v=0",
  "o=- 0 0 IN IP4 127.0.0.1",
  "s=khepree-livetalking-spike",
  "t=0 0",
  "a=group:BUNDLE 0",
  "m=audio 9 UDP/TLS/RTP/SAVPF 111",
  "c=IN IP4 0.0.0.0",
  "a=rtcp:9 IN IP4 0.0.0.0",
  "a=ice-ufrag:khep",
  "a=ice-pwd:khepreeexternalspike0001",
  "a=fingerprint:sha-256 00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00",
  "a=setup:actpass",
  "a=mid:0",
  "a=sendrecv",
  "a=rtcp-mux",
  "a=rtpmap:111 opus/48000/2"
].join("\r\n");

function nowIso(): string {
  return new Date().toISOString();
}

export function normalizeLiveTalkingBaseUrl(serverUrl: string): string {
  return serverUrl.trim().replace(/\/+$/, "");
}

export class LiveTalkingHttpClient {
  readonly baseUrl: string;
  readonly avatarId: string;
  readonly model?: string;
  readonly transport: LiveTalkingTransport;
  readonly connectionTimeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  lastAudioAccepted = false;
  lastSessionId: string | undefined;

  constructor(opts: LiveTalkingClientOptions) {
    this.baseUrl = normalizeLiveTalkingBaseUrl(opts.serverUrl);
    this.avatarId = opts.avatarId.trim();
    this.model = opts.model?.trim() || undefined;
    this.transport = opts.transport ?? "webrtc";
    this.connectionTimeoutMs = opts.connectionTimeoutMs ?? 8_000;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  private signal(): AbortSignal {
    return AbortSignal.timeout(this.connectionTimeoutMs);
  }

  async probeReachable(): Promise<boolean> {
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/`, {
        method: "GET",
        signal: this.signal()
      });
      return res.status > 0 && res.status < 500;
    } catch {
      return false;
    }
  }

  /**
   * Avatar existence — prefer GET /avatars/:id (fake + future admin);
   * real LiveTalking may 404; then we treat configured id as unknown-ok until /offer.
   */
  async probeAvatarExists(): Promise<boolean> {
    if (!this.avatarId) return false;
    try {
      const res = await this.fetchImpl(
        `${this.baseUrl}/avatars/${encodeURIComponent(this.avatarId)}`,
        { method: "GET", signal: this.signal() }
      );
      if (res.status === 200) return true;
      if (res.status === 404) return false;
    } catch {
      /* fall through */
    }
    // Upstream may not expose /avatars — configured id counts as "declared".
    return Boolean(this.avatarId);
  }

  async offerSession(): Promise<LiveTalkingOfferResult> {
    const res = await this.fetchImpl(`${this.baseUrl}/offer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sdp: MINIMAL_WEBRTC_OFFER_SDP,
        type: "offer",
        avatar: this.avatarId,
        ...(this.model ? { model: this.model } : {})
      }),
      signal: this.signal()
    });
    if (!res.ok) {
      throw new Error(`LIVETALKING_OFFER_HTTP_${res.status}`);
    }
    const json = (await res.json()) as {
      sessionid?: string | number;
      sessionId?: string | number;
      sdp?: string;
      code?: number;
      msg?: string;
    };
    if (typeof json.code === "number" && json.code !== 0) {
      throw new Error(`LIVETALKING_OFFER:${json.msg ?? json.code}`);
    }
    const sid = String(json.sessionid ?? json.sessionId ?? "").trim();
    if (!sid) throw new Error("LIVETALKING_OFFER_NO_SESSION");
    this.lastSessionId = sid;
    return { sessionId: sid, answerSdp: json.sdp };
  }

  async pushAudioFile(sessionId: string, filePath: string): Promise<void> {
    const abs = path.resolve(filePath);
    const buf = fs.readFileSync(abs);
    const form = new FormData();
    form.append("sessionid", sessionId);
    form.append("file", new Blob([new Uint8Array(buf)], { type: "audio/wav" }), path.basename(abs));
    const res = await this.fetchImpl(`${this.baseUrl}/humanaudio`, {
      method: "POST",
      body: form,
      signal: this.signal()
    });
    if (!res.ok) {
      this.lastAudioAccepted = false;
      throw new Error(`LIVETALKING_HUMANAUDIO_HTTP_${res.status}`);
    }
    const json = (await res.json().catch(() => ({}))) as { code?: number; msg?: string };
    if (typeof json.code === "number" && json.code !== 0) {
      this.lastAudioAccepted = false;
      throw new Error(`LIVETALKING_HUMANAUDIO:${json.msg ?? json.code}`);
    }
    this.lastAudioAccepted = true;
  }

  async interrupt(sessionId: string): Promise<void> {
    const res = await this.fetchImpl(`${this.baseUrl}/interrupt_talk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionid: sessionId }),
      signal: this.signal()
    });
    if (!res.ok) throw new Error(`LIVETALKING_INTERRUPT_HTTP_${res.status}`);
  }

  async probe(opts?: {
    sessionStarted?: boolean;
    outputAvailable?: boolean;
  }): Promise<LiveTalkingHealthProbe> {
    const serverReachable = await this.probeReachable();
    const avatarExists = serverReachable ? await this.probeAvatarExists() : false;
    const sessionStarted = Boolean(opts?.sessionStarted ?? this.lastSessionId);
    const audioAccepted = this.lastAudioAccepted;
    const outputAvailable = Boolean(
      opts?.outputAvailable ?? (sessionStarted && serverReachable)
    );
    const parts: string[] = [];
    if (!serverReachable) parts.push("server unreachable");
    else if (!avatarExists) parts.push("avatar missing");
    else if (!sessionStarted) parts.push("no session");
    else if (!audioAccepted) parts.push("waiting audio");
    else parts.push("ok");
    return {
      serverReachable,
      avatarExists,
      sessionStarted,
      audioAccepted,
      outputAvailable,
      message: parts.join("; "),
      checkedAt: nowIso()
    };
  }
}
