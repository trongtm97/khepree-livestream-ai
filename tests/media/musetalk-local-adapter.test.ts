/**
 * MuseTalk local adapter — fake HTTP worker (no CUDA / no model download).
 */
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MuseTalkLocalProvider } from "../../src/main/connectors/media/avatar/musetalk-local-provider";
import { MuseTalkHttpClient } from "../../src/main/connectors/media/avatar/musetalk-http-client";
import {
  isMuseTalkEngineConfigured,
  normalizeAvatarEngine
} from "../../src/shared/media-contracts";

type FakeState = {
  initialized: boolean;
  sessions: Map<string, { accountId: string; audio: string[] }>;
  jobs: number;
};

function startFakeMuseTalk(token: string): Promise<{
  baseUrl: string;
  state: FakeState;
  close: () => Promise<void>;
}> {
  const state: FakeState = {
    initialized: false,
    sessions: new Map(),
    jobs: 0
  };
  let seq = 0;

  const server = http.createServer((req, res) => {
    const auth = req.headers.authorization ?? "";
    if (auth !== `Bearer ${token}`) {
      res.writeHead(401);
      res.end("unauthorized");
      return;
    }
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const method = req.method ?? "GET";

    const json = (code: number, body: unknown) => {
      res.writeHead(code, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    };

    const read = (): Promise<unknown> =>
      new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
        req.on("end", () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
          } catch (e) {
            reject(e);
          }
        });
        req.on("error", reject);
      });

    if (method === "GET" && url.pathname === "/health") {
      const inferFPS = state.jobs > 0 ? 40 : 0;
      const realtimeOk = inferFPS >= 25;
      json(200, {
        status: !state.initialized ? "LOADING" : realtimeOk || state.jobs === 0 ? "READY" : "DEGRADED",
        message: "fake musetalk",
        initialized: state.initialized,
        productionReady: false,
        metrics: {
          inferFPS,
          finalFPS: inferFPS,
          vramMb: 0,
          gpuUtilization: 0,
          queueDelayMs: 1,
          realtimeOk,
          gpuTier: realtimeOk ? "realtime" : "unbenchmarked"
        }
      });
      return;
    }

    if (method === "POST" && url.pathname === "/initialize") {
      void read().then((body) => {
        const b = body as { avatarId?: string; sourceVideoPath?: string; modelDir?: string };
        if (!b.modelDir || !b.sourceVideoPath || !b.avatarId) {
          json(400, { detail: "missing" });
          return;
        }
        state.initialized = true;
        json(200, { ok: true, preprocess: { cacheHit: false, ready: true } });
      });
      return;
    }

    if (method === "POST" && url.pathname === "/session/start") {
      void read().then((body) => {
        if (!state.initialized) {
          json(409, { detail: "not initialized" });
          return;
        }
        const b = body as { accountId: string; sessionId: string };
        seq += 1;
        const id = `mt_fake_${seq}`;
        state.sessions.set(id, { accountId: b.accountId, audio: [] });
        json(200, {
          ok: true,
          session: {
            providerSessionId: id,
            accountId: b.accountId,
            sessionId: b.sessionId
          }
        });
      });
      return;
    }

    if (method === "POST" && url.pathname === "/session/audio") {
      void read().then((body) => {
        const b = body as { providerSessionId: string; audioPath: string };
        const sess = state.sessions.get(b.providerSessionId);
        if (!sess) {
          json(404, { detail: "no session" });
          return;
        }
        sess.audio.push(b.audioPath);
        state.jobs += 1;
        json(200, { ok: true, queueDelayMs: 2 });
      });
      return;
    }

    if (method === "POST" && url.pathname === "/session/stop") {
      void read().then((body) => {
        const b = body as { providerSessionId: string };
        state.sessions.delete(b.providerSessionId);
        json(200, { ok: true });
      });
      return;
    }

    if (method === "GET" && url.pathname === "/metrics") {
      json(200, {
        ok: true,
        productionReady: false,
        inferFPS: state.jobs > 0 ? 40 : 0,
        finalFPS: state.jobs > 0 ? 40 : 0,
        vramMb: 0,
        gpuUtilization: 0,
        queueDelayMs: 1,
        realtimeOk: state.jobs > 0,
        gpuTier: state.jobs > 0 ? "realtime" : "unbenchmarked"
      });
      return;
    }

    json(404, { detail: "no" });
  });

  return new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("no port"));
        return;
      }
      resolve({
        baseUrl: `http://127.0.0.1:${addr.port}`,
        state,
        close: () =>
          new Promise((r, j) => {
            server.close((err) => (err ? j(err) : r()));
          })
      });
    });
  });
}

describe("MuseTalk local provider (fake worker, no CUDA)", () => {
  const token = "test-token";
  let baseUrl = "";
  let state: FakeState;
  let close: () => Promise<void>;
  let tmpVideo = "";
  let tmpWav = "";

  beforeAll(async () => {
    const fake = await startFakeMuseTalk(token);
    baseUrl = fake.baseUrl;
    state = fake.state;
    close = fake.close;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mt-"));
    tmpVideo = path.join(dir, "src.mp4");
    tmpWav = path.join(dir, "utt.wav");
    fs.writeFileSync(tmpVideo, Buffer.from("fakevideo"));
    fs.writeFileSync(tmpWav, Buffer.from("RIFF"));
  });

  afterAll(async () => {
    await close();
  });

  it("normalizes musetalk-local config", () => {
    expect(
      isMuseTalkEngineConfigured({
        kind: "musetalk-local",
        serverUrl: "http://127.0.0.1:1",
        avatarId: "a",
        modelDir: "C:/models",
        sourceVideoPath: "C:/a.mp4"
      })
    ).toBe(true);
    expect(normalizeAvatarEngine({ kind: "none" }).kind).toBe("none");
  });

  it("A/B sessions stay isolated; stop A leaves B", async () => {
    const settings = {
      kind: "musetalk-local" as const,
      serverUrl: baseUrl,
      avatarId: "avatar1",
      modelDir: path.dirname(tmpVideo),
      sourceVideoPath: tmpVideo,
      connectionTimeoutMs: 5000
    };
    const a = new MuseTalkLocalProvider({ settings, token, fetchImpl: fetch });
    const b = new MuseTalkLocalProvider({ settings, token, fetchImpl: fetch });

    await a.initialize({
      id: "avatar1",
      name: "A",
      providerId: "musetalk-local",
      sourceAssetPath: tmpVideo,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const sa = await a.startSession({ accountId: "acc_a", sessionId: "s_a" });
    const sb = await b.startSession({ accountId: "acc_b", sessionId: "s_b" });
    expect(sa.providerSessionId).not.toBe(sb.providerSessionId);

    await a.pushAudio({ path: tmpWav, format: "wav" });
    await b.pushAudio({ path: tmpWav, format: "wav" });
    expect(state.sessions.get(sa.providerSessionId)?.audio.length).toBe(1);
    expect(state.sessions.get(sb.providerSessionId)?.audio.length).toBe(1);

    await a.stopSession();
    expect(state.sessions.has(sa.providerSessionId)).toBe(false);
    expect(state.sessions.get(sb.providerSessionId)?.audio.length).toBe(1);

    await a.dispose();
    await b.dispose();
  });

  it("metrics report productionReady false", async () => {
    const client = new MuseTalkHttpClient({
      serverUrl: baseUrl,
      token,
      connectionTimeoutMs: 3000
    });
    const m = await client.metrics();
    expect(m.productionReady).toBe(false);
  });
});
