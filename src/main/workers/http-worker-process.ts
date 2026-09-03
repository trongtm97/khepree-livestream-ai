import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export interface WorkerSpec {
  name: string;
  scriptPath: string;
  pythonExecutable: string;
  startupTimeoutMs: number;
}

export class HttpWorkerProcess {
  private process?: ChildProcessWithoutNullStreams;
  private port?: number;
  private token?: string;

  constructor(private readonly spec: WorkerSpec) {}

  get baseUrl(): string {
    if (!this.port) throw new Error(`${this.spec.name} not started`);
    return `http://127.0.0.1:${this.port}`;
  }

  async start(): Promise<void> {
    if (this.process && !this.process.killed) return;
    if (!fs.existsSync(this.spec.scriptPath)) {
      throw new Error(`Worker script missing: ${this.spec.scriptPath}`);
    }

    this.port = 32000 + Math.floor(Math.random() * 20000);
    this.token = randomBytes(32).toString("hex");

    this.process = spawn(
      this.spec.pythonExecutable,
      [this.spec.scriptPath, "--port", String(this.port)],
      {
        env: {
          ...process.env,
          KHEPREE_WORKER_TOKEN: this.token
        },
        windowsHide: true
      }
    );

    this.process.stdout.on("data", (d) => console.info(`[${this.spec.name}]`, String(d).trim()));
    this.process.stderr.on("data", (d) => console.warn(`[${this.spec.name}]`, String(d).trim()));
    this.process.on("exit", (code) => {
      console.warn(`${this.spec.name} exited`, code);
      this.process = undefined;
    });

    const deadline = Date.now() + this.spec.startupTimeoutMs;
    while (Date.now() < deadline) {
      try {
        const res = await this.request("/health", { method: "GET" });
        if (res.ok) return;
      } catch {
        // retry
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    await this.stop();
    throw new Error(`${this.spec.name} startup timeout`);
  }

  async stop(): Promise<void> {
    this.process?.kill();
    this.process = undefined;
    this.port = undefined;
    this.token = undefined;
  }

  async request(pathname: string, init: RequestInit = {}): Promise<Response> {
    if (!this.token) throw new Error(`${this.spec.name} not started`);
    return fetch(`${this.baseUrl}${pathname}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.token}`,
        ...(init.headers ?? {})
      }
    });
  }
}
