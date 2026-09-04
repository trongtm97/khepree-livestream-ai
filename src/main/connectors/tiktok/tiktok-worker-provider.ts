import path from "node:path";
import { HttpWorkerProcess } from "../../workers/http-worker-process";
import type { LiveEvent, RuntimeHealth } from "../../../shared/live-types";
import type { TikTokProvider } from "./types";

export class TikTokWorkerProvider implements TikTokProvider {
  private readonly worker: HttpWorkerProcess;
  private started = false;

  constructor(appRoot: string, pythonExecutable = "python", startupTimeoutMs = 20000) {
    this.worker = new HttpWorkerProcess({
      name: "tiktok-worker",
      scriptPath: path.join(appRoot, "workers", "tiktok_worker", "app.py"),
      pythonExecutable,
      startupTimeoutMs
    });
  }

  isStarted(): boolean {
    return this.started;
  }

  async startWorker(): Promise<void> {
    if (this.started) return;
    await this.worker.start();
    this.started = true;
  }

  async health(): Promise<RuntimeHealth> {
    try {
      const res = await this.worker.request("/health", { method: "GET" });
      const body = (await res.json()) as {
        connected?: boolean;
        message?: string;
        dependencyInstalled?: boolean;
      };
      return {
        component: "tiktok:tiktoklive",
        status: res.ok ? (body.connected ? "OK" : "DEGRADED") : "DOWN",
        message: body.message ?? (body.connected ? "Connected" : "Worker ready, not connected"),
        checkedAt: new Date().toISOString()
      };
    } catch (error) {
      return {
        component: "tiktok:tiktoklive",
        status: "DOWN",
        message: String(error),
        checkedAt: new Date().toISOString()
      };
    }
  }

  async healthDetail(): Promise<{
    connected: boolean;
    dependencyInstalled: boolean;
    message: string;
    status: RuntimeHealth["status"];
  }> {
    try {
      await this.startWorker();
      const res = await this.worker.request("/health", { method: "GET" });
      const body = (await res.json()) as {
        connected?: boolean;
        message?: string;
        dependencyInstalled?: boolean;
      };
      return {
        connected: Boolean(body.connected),
        dependencyInstalled: Boolean(body.dependencyInstalled),
        message: body.message ?? "worker ready",
        status: res.ok ? (body.connected ? "OK" : "DEGRADED") : "DOWN"
      };
    } catch (error) {
      return {
        connected: false,
        dependencyInstalled: false,
        message: String(error),
        status: "DOWN"
      };
    }
  }

  async connect(uniqueId: string): Promise<void> {
    await this.startWorker();
    const res = await this.worker.request("/v1/connect", {
      method: "POST",
      body: JSON.stringify({ uniqueId: normalizeUniqueId(uniqueId) })
    });
    if (!res.ok) {
      const text = await res.text();
      if (text.toLowerCase().includes("not installed")) {
        throw new Error("TIKTOK_DEPENDENCY_MISSING");
      }
      if (res.status === 409) {
        // Already connected — treat as success for reconnect races.
        return;
      }
      throw new Error(`TIKTOK_CONNECT_FAILED:${text.slice(0, 200)}`);
    }
  }

  /** Disconnect TikTokLive client but keep worker process alive (for reconnect). */
  async disconnectClient(): Promise<void> {
    if (!this.started) return;
    await this.worker.request("/v1/disconnect", { method: "POST", body: "{}" });
  }

  async disconnect(): Promise<void> {
    try {
      await this.disconnectClient();
    } catch {
      // ignore
    } finally {
      await this.worker.stop();
      this.started = false;
    }
  }

  async drainEvents(afterSequence: number): Promise<LiveEvent[]> {
    if (!this.started) return [];
    const res = await this.worker.request(
      `/v1/events?after=${encodeURIComponent(String(afterSequence))}&limit=200`,
      { method: "GET" }
    );
    if (!res.ok) return [];
    const body = (await res.json()) as { events?: LiveEvent[] };
    return Array.isArray(body.events) ? body.events : [];
  }
}

export function normalizeUniqueId(raw: string): string {
  const trimmed = raw.trim().replace(/^@+/, "");
  if (!trimmed) return "";
  return `@${trimmed}`;
}
