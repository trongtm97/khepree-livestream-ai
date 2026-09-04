/**
 * Fake LiveTalking HTTP server — automated adapter tests (no real GPU / models).
 */
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ExternalLiveTalkingProvider } from "../../src/main/connectors/media/avatar/external-livetalking-provider";
import { LiveTalkingHttpClient } from "../../src/main/connectors/media/avatar/livetalking-http-client";

type SessionRec = { id: string; avatar: string; audioFiles: string[] };

function startFakeLiveTalking(knownAvatars: string[]): Promise<{
  baseUrl: string;
  sessions: Map<string, SessionRec>;
  close: () => Promise<void>;
}> {
  const sessions = new Map<string, SessionRec>();
  let seq = 0;

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const method = req.method ?? "GET";

    if (method === "GET" && url.pathname === "/") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<html>fake livetalking</html>");
      return;
    }

    if (method === "GET" && url.pathname.startsWith("/avatars/")) {
      const id = decodeURIComponent(url.pathname.slice("/avatars/".length));
      if (knownAvatars.includes(id)) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ id, ok: true }));
      } else {
        res.writeHead(404);
        res.end("missing");
      }
      return;
    }

    if (method === "POST" && url.pathname === "/offer") {
      void (async () => {
        const body = await readBody(req);
        const json = JSON.parse(body.toString("utf8")) as { avatar?: string };
        const avatar = json.avatar ?? "";
        if (!knownAvatars.includes(avatar)) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ code: 1, msg: "avatar not found" }));
          return;
        }
        seq += 1;
        const sessionid = `lt_sess_${seq}`;
        sessions.set(sessionid, { id: sessionid, avatar, audioFiles: [] });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            sdp: "v=0\r\n",
            type: "answer",
            sessionid
          })
        );
      })();
      return;
    }

    if (method === "POST" && url.pathname === "/humanaudio") {
      void (async () => {
        const { fields, files } = await parseMultipart(req);
        const sessionid = fields.sessionid ?? "";
        const sess = sessions.get(sessionid);
        if (!sess) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ code: 1, msg: "no session" }));
          return;
        }
        if (files.file) sess.audioFiles.push(files.file);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ code: 0, msg: "ok" }));
      })();
      return;
    }

    if (method === "POST" && url.pathname === "/interrupt_talk") {
      void (async () => {
        await readBody(req);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ code: 0, msg: "ok" }));
      })();
      return;
    }

    res.writeHead(404);
    res.end("no");
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
        sessions,
        close: () =>
          new Promise((r, j) => {
            server.close((err) => (err ? j(err) : r()));
          })
      });
    });
  });
}

function readBody(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function parseMultipart(req: http.IncomingMessage): Promise<{
  fields: Record<string, string>;
  files: Record<string, string>;
}> {
  const ctype = req.headers["content-type"] ?? "";
  const m = /boundary=(.+)$/i.exec(ctype);
  const body = await readBody(req);
  const fields: Record<string, string> = {};
  const files: Record<string, string> = {};
  if (!m) return { fields, files };
  const boundary = m[1]!;
  const parts = body.toString("binary").split(`--${boundary}`);
  for (const part of parts) {
    if (!part || part === "--\r\n" || part === "--") continue;
    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd < 0) continue;
    const headers = part.slice(0, headerEnd);
    let content = part.slice(headerEnd + 4);
    if (content.endsWith("\r\n")) content = content.slice(0, -2);
    const nameMatch = /name="([^"]+)"/i.exec(headers);
    if (!nameMatch) continue;
    const name = nameMatch[1]!;
    if (/filename=/i.test(headers)) {
      files[name] = Buffer.from(content, "binary").toString("base64").slice(0, 32);
    } else {
      fields[name] = content.trim();
    }
  }
  return { fields, files };
}

describe("LiveTalking HTTP adapter (fake server)", () => {
  let baseUrl = "";
  let sessions: Map<string, SessionRec>;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const fake = await startFakeLiveTalking(["wav2lip256_avatar1"]);
    baseUrl = fake.baseUrl;
    sessions = fake.sessions;
    close = fake.close;
  });

  afterAll(async () => {
    await close();
  });

  it("maps A/B sessions separately; stop A does not clear B audio", async () => {
    const providerA = new ExternalLiveTalkingProvider({
      settings: {
        kind: "livetalking",
        serverUrl: baseUrl,
        avatarId: "wav2lip256_avatar1",
        model: "wav2lip",
        transport: "webrtc",
        connectionTimeoutMs: 3000
      }
    });
    const providerB = new ExternalLiveTalkingProvider({
      settings: {
        kind: "livetalking",
        serverUrl: baseUrl,
        avatarId: "wav2lip256_avatar1",
        connectionTimeoutMs: 3000
      }
    });

    const sessA = await providerA.startSession({ accountId: "acc_a", sessionId: "khep_a1" });
    const sessB = await providerB.startSession({ accountId: "acc_b", sessionId: "khep_b1" });
    expect(sessA.providerSessionId).not.toBe(sessB.providerSessionId);

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lt-wav-"));
    const wavA = path.join(tmp, "a.wav");
    const wavB = path.join(tmp, "b.wav");
    fs.writeFileSync(wavA, Buffer.from("RIFF_A"));
    fs.writeFileSync(wavB, Buffer.from("RIFF_B"));

    await providerA.pushAudio({ path: wavA, format: "wav" });
    await providerB.pushAudio({ path: wavB, format: "wav" });

    expect(sessions.get(sessA.providerSessionId)?.audioFiles.length).toBe(1);
    expect(sessions.get(sessB.providerSessionId)?.audioFiles.length).toBe(1);

    await providerA.interrupt();
    await providerA.stopSession();

    expect(sessions.get(sessB.providerSessionId)?.audioFiles.length).toBe(1);

    await providerA.dispose();
    await providerB.dispose();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("health reports reachable + avatar + session bits", async () => {
    const client = new LiveTalkingHttpClient({
      serverUrl: baseUrl,
      avatarId: "wav2lip256_avatar1",
      connectionTimeoutMs: 3000
    });
    const before = await client.probe();
    expect(before.serverReachable).toBe(true);
    expect(before.avatarExists).toBe(true);
    expect(before.sessionStarted).toBe(false);

    const offer = await client.offerSession();
    const after = await client.probe({ sessionStarted: true, outputAvailable: true });
    expect(after.sessionStarted).toBe(true);
    expect(offer.sessionId).toBeTruthy();
  });

  it("missing avatar fails offer", async () => {
    const client = new LiveTalkingHttpClient({
      serverUrl: baseUrl,
      avatarId: "does_not_exist",
      connectionTimeoutMs: 3000
    });
    await expect(client.offerSession()).rejects.toThrow(/LIVETALKING_OFFER/);
  });
});
