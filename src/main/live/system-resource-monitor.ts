/**
 * Background OS resource sampler — never blocks Electron main on sleep().
 * CPU: delta of os.cpus() times. GPU: optional nvidia-smi via execFile.
 */
import { execFile } from "node:child_process";
import os from "node:os";
import { promisify } from "node:util";
import type {
  GpuSnapshot,
  ResourceMetric,
  SystemResourcePublicSnapshot
} from "../../shared/system-resources";

const execFileAsync = promisify(execFile);

export type CpuTimesSample = { idle: number; total: number };

export type SystemResourceMonitorOptions = {
  /** How often to take a CPU sample (ms). Pair of samples yields usage. */
  sampleIntervalMs?: number;
  /** How often to refresh NVIDIA query (ms). */
  nvidiaIntervalMs?: number;
  /** nvidia-smi timeout. */
  nvidiaTimeoutMs?: number;
  /** Disable NVIDIA probe (tests / non-Windows). */
  enableNvidia?: boolean;
  /** Test seams */
  readCpus?: () => os.CpuInfo[];
  readMem?: () => { total: number; free: number };
  queryNvidia?: () => Promise<GpuSnapshot>;
  now?: () => number;
};

type Cached = SystemResourcePublicSnapshot;

function sumCpuTimes(cpus: os.CpuInfo[]): CpuTimesSample {
  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    const t = cpu.times;
    idle += t.idle;
    total += t.user + t.nice + t.sys + t.irq + t.idle;
  }
  return { idle, total };
}

/** Pure helper — used by tests with mock samples. */
export function cpuUsageFromDelta(prev: CpuTimesSample, next: CpuTimesSample): ResourceMetric {
  const dIdle = next.idle - prev.idle;
  const dTotal = next.total - prev.total;
  if (dTotal <= 0) return "UNKNOWN";
  const busy = 1 - dIdle / dTotal;
  return Math.min(100, Math.max(0, Math.round(busy * 100)));
}

export function parseNvidiaSmiCsv(line: string): GpuSnapshot {
  // name, memory.total, memory.used, memory.free, utilization.gpu — nounits
  const parts = line.split(",").map((p) => p.trim());
  if (parts.length < 5) return "UNKNOWN";
  const name = parts[0] || undefined;
  const total = Number(parts[1]);
  const used = Number(parts[2]);
  const free = Number(parts[3]);
  const util = Number(parts[4]);
  const num = (n: number): ResourceMetric => (Number.isFinite(n) ? Math.round(n) : "UNKNOWN");
  return {
    vendor: "NVIDIA",
    name,
    available: true,
    vramTotalMb: num(total),
    vramUsedMb: num(used),
    vramFreeMb: num(free),
    utilizationPercent: num(util)
  };
}

async function defaultQueryNvidia(timeoutMs: number): Promise<GpuSnapshot> {
  try {
    const { stdout } = await execFileAsync(
      "nvidia-smi",
      [
        "--query-gpu=name,memory.total,memory.used,memory.free,utilization.gpu",
        "--format=csv,noheader,nounits"
      ],
      { timeout: timeoutMs, windowsHide: true, encoding: "utf8" }
    );
    const line = String(stdout)
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l.length > 0);
    if (!line) return "UNKNOWN";
    return parseNvidiaSmiCsv(line);
  } catch {
    return "UNKNOWN";
  }
}

/**
 * Background monitor: caches CPU/RAM/GPU. snapshot() is sync and cheap.
 */
export class SystemResourceMonitor {
  private readonly sampleIntervalMs: number;
  private readonly nvidiaIntervalMs: number;
  private readonly nvidiaTimeoutMs: number;
  private readonly enableNvidia: boolean;
  private readonly readCpus: () => os.CpuInfo[];
  private readonly readMem: () => { total: number; free: number };
  private readonly queryNvidia: () => Promise<GpuSnapshot>;
  private readonly now: () => number;

  private timer?: NodeJS.Timeout;
  private prevCpu?: CpuTimesSample;
  private lastNvidiaAt = 0;
  private nvidiaInFlight = false;
  private cached: Cached = {
    checkedAt: new Date(0).toISOString(),
    cpuLoadPercent: "UNKNOWN",
    ramAvailableMb: "UNKNOWN",
    ramUsedPercent: "UNKNOWN",
    gpu: "UNKNOWN"
  };

  constructor(opts: SystemResourceMonitorOptions = {}) {
    this.sampleIntervalMs = Math.max(200, opts.sampleIntervalMs ?? 750);
    this.nvidiaIntervalMs = Math.max(1_000, opts.nvidiaIntervalMs ?? 5_000);
    this.nvidiaTimeoutMs = Math.max(500, opts.nvidiaTimeoutMs ?? 2_000);
    this.enableNvidia = opts.enableNvidia ?? process.platform === "win32";
    this.readCpus = opts.readCpus ?? (() => os.cpus());
    this.readMem =
      opts.readMem ??
      (() => ({
        total: os.totalmem(),
        free: os.freemem()
      }));
    this.queryNvidia =
      opts.queryNvidia ?? (() => defaultQueryNvidia(this.nvidiaTimeoutMs));
    this.now = opts.now ?? (() => Date.now());
  }

  /** Latest cached metrics — never blocks. */
  getSnapshot(): SystemResourcePublicSnapshot {
    return { ...this.cached, gpu: this.cached.gpu };
  }

  start(): void {
    if (this.timer) return;
    this.tick();
    this.timer = setInterval(() => this.tick(), this.sampleIntervalMs);
    // Unref so monitor does not keep the process alive alone in tests.
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.prevCpu = undefined;
  }

  /** Test/manual: force one sample cycle. */
  tick(): void {
    this.updateRam();
    this.updateCpu();
    this.maybeRefreshNvidia();
    this.cached.checkedAt = new Date(this.now()).toISOString();
  }

  private updateRam(): void {
    try {
      const { total, free } = this.readMem();
      this.cached.ramAvailableMb = Math.floor(free / (1024 * 1024));
      this.cached.ramUsedPercent =
        total > 0 ? Math.min(100, Math.round(((total - free) / total) * 100)) : "UNKNOWN";
    } catch {
      this.cached.ramAvailableMb = "UNKNOWN";
      this.cached.ramUsedPercent = "UNKNOWN";
    }
  }

  private updateCpu(): void {
    try {
      const sample = sumCpuTimes(this.readCpus());
      if (this.prevCpu) {
        this.cached.cpuLoadPercent = cpuUsageFromDelta(this.prevCpu, sample);
      }
      this.prevCpu = sample;
    } catch {
      this.cached.cpuLoadPercent = "UNKNOWN";
    }
  }

  private maybeRefreshNvidia(): void {
    if (!this.enableNvidia) return;
    const now = this.now();
    if (this.nvidiaInFlight) return;
    if (now - this.lastNvidiaAt < this.nvidiaIntervalMs && this.cached.gpu !== "UNKNOWN") {
      return;
    }
    // Allow first probe even if still UNKNOWN.
    if (now - this.lastNvidiaAt < this.nvidiaIntervalMs && this.lastNvidiaAt > 0) return;

    this.nvidiaInFlight = true;
    void this.queryNvidia()
      .then((gpu) => {
        this.cached.gpu = gpu;
        this.lastNvidiaAt = this.now();
      })
      .catch(() => {
        this.cached.gpu = "UNKNOWN";
        this.lastNvidiaAt = this.now();
      })
      .finally(() => {
        this.nvidiaInFlight = false;
      });
  }
}

export function createSystemResourceMonitor(
  opts?: SystemResourceMonitorOptions
): SystemResourceMonitor {
  return new SystemResourceMonitor(opts);
}
