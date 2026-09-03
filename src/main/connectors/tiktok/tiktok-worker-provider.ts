import path from "node:path";
import { HttpWorkerProcess } from "../../workers/http-worker-process";
import type { LiveEvent, RuntimeHealth } from "../../../shared/live-types";
import type { TikTokProvider } from "./types";

export class TikTokWorkerProvider implements TikTokProvider {
  private readonly worker: HttpWorkerProcess;

  constructor(appRoot: string, pythonExecutable = "python", startupTimeoutMs = 20000) {
    this.worker = new HttpWorkerProcess({
      name: "tiktok-worker",
      scriptPath: path.join(appRoot, "workers", "tiktok_worker", "app.py"),
      pythonExecutable,
      startupTimeoutMs
    });
  }

  async startWorker(): Promise<void> {
    await this.worker.start();
  }

  async health(): Promise<RuntimeHealth> {
    try {
      const res = await this.worker.request("/health", { method: "GET" });
      const body = await res.json() as any;
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

  async connect(uniqueId: string): Promise<void> {
    await this.startWorker();
    const res = await this.worker.request("/v1/connect", {
      method: "POST",
      body: JSON.stringify({ uniqueId })
    });
    if (!res.ok) throw new Error(await res.text());
  }

  async disconnect(): Promise<void> {
    try {
      await this.worker.request("/v1/disconnect", { method: "POST", body: "{}" });
    } finally {
      await this.worker.stop();
    }
  }

  async drainEvents(afterSequence: number): Promise<LiveEvent[]> {
    const res = await this.worker.request(
      `/v1/events?after=${encodeURIComponent(String(afterSequence))}&limit=200`,
      { method: "GET" }
    );
    if (!res.ok) return [];
    const body = await res.json() as any;
    return Array.isArray(body.events) ? body.events as LiveEvent[] : [];
  }
}
