/**
 * SystemResourceMonitor — mock sampler; no nvidia-smi required in CI.
 */
import { describe, expect, it } from "vitest";
import {
  createOsResourceGovernor,
  createMockResourceGovernor
} from "../../src/main/live/resource-governor";
import {
  cpuUsageFromDelta,
  createSystemResourceMonitor,
  parseNvidiaSmiCsv,
  type CpuTimesSample
} from "../../src/main/live/system-resource-monitor";
import type { CpuInfo } from "node:os";

function fakeCpus(idle: number, busy: number): CpuInfo[] {
  return [
    {
      model: "test",
      speed: 1000,
      times: { user: busy, nice: 0, sys: 0, idle, irq: 0 }
    }
  ];
}

describe("cpuUsageFromDelta", () => {
  it("computes busy percent from idle/total delta", () => {
    const prev: CpuTimesSample = { idle: 100, total: 200 };
    const next: CpuTimesSample = { idle: 110, total: 300 };
    // dIdle=10, dTotal=100 → busy 90%
    expect(cpuUsageFromDelta(prev, next)).toBe(90);
  });

  it("returns UNKNOWN when total does not advance", () => {
    expect(cpuUsageFromDelta({ idle: 1, total: 1 }, { idle: 1, total: 1 })).toBe(
      "UNKNOWN"
    );
  });
});

describe("parseNvidiaSmiCsv", () => {
  it("parses nvidia-smi csv line", () => {
    const gpu = parseNvidiaSmiCsv("RTX 3060, 12288, 4096, 8192, 42");
    expect(gpu).not.toBe("UNKNOWN");
    if (gpu === "UNKNOWN") return;
    expect(gpu.vendor).toBe("NVIDIA");
    expect(gpu.name).toBe("RTX 3060");
    expect(gpu.vramTotalMb).toBe(12288);
    expect(gpu.vramUsedMb).toBe(4096);
    expect(gpu.vramFreeMb).toBe(8192);
    expect(gpu.utilizationPercent).toBe(42);
    expect(gpu.available).toBe(true);
  });

  it("returns UNKNOWN on garbage", () => {
    expect(parseNvidiaSmiCsv("nope")).toBe("UNKNOWN");
  });
});

describe("SystemResourceMonitor", () => {
  it("caches CPU after two samples without sleeping in getSnapshot", () => {
    let n = 0;
    const monitor = createSystemResourceMonitor({
      enableNvidia: false,
      sampleIntervalMs: 10_000,
      readCpus: () => {
        n += 1;
        // First sample mostly idle; second shows busy work.
        return n === 1 ? fakeCpus(1000, 100) : fakeCpus(1010, 500);
      },
      readMem: () => ({ total: 8 * 1024 ** 3, free: 4 * 1024 ** 3 })
    });

    monitor.tick();
    expect(monitor.getSnapshot().cpuLoadPercent).toBe("UNKNOWN");

    monitor.tick();
    const snap = monitor.getSnapshot();
    expect(typeof snap.cpuLoadPercent).toBe("number");
    expect(snap.cpuLoadPercent).toBeGreaterThan(50);
    expect(snap.ramAvailableMb).toBe(4096);
    expect(snap.ramUsedPercent).toBe(50);
    expect(snap.gpu).toBe("UNKNOWN");
  });

  it("uses injected nvidia query (no real nvidia-smi)", async () => {
    const monitor = createSystemResourceMonitor({
      enableNvidia: true,
      nvidiaIntervalMs: 1,
      sampleIntervalMs: 10_000,
      readCpus: () => fakeCpus(1, 1),
      readMem: () => ({ total: 1024 ** 3, free: 512 * 1024 ** 2 }),
      queryNvidia: async () => ({
        vendor: "NVIDIA",
        name: "Mock GPU",
        available: true,
        utilizationPercent: 88,
        vramTotalMb: 8192,
        vramUsedMb: 2048,
        vramFreeMb: 6144
      })
    });

    monitor.tick();
    await new Promise((r) => setTimeout(r, 20));
    const snap = monitor.getSnapshot();
    expect(snap.gpu).not.toBe("UNKNOWN");
    if (snap.gpu === "UNKNOWN") return;
    expect(snap.gpu.utilizationPercent).toBe(88);
    expect(snap.gpu.vendor).toBe("NVIDIA");
  });
});

describe("createOsResourceGovernor + UNKNOWN CPU", () => {
  it("does not block start when CPU is UNKNOWN", () => {
    const monitor = createSystemResourceMonitor({
      enableNvidia: false,
      readCpus: () => fakeCpus(1, 1),
      readMem: () => ({ total: 16 * 1024 ** 3, free: 8 * 1024 ** 3 })
    });
    // Only one tick → CPU still UNKNOWN
    monitor.tick();
    const gov = createOsResourceGovernor({ monitor });
    const ev = gov.evaluateStart({
      activeRuntimes: 0,
      activeTikTokWorkers: 0,
      activeBrowserContexts: 0,
      aiQueueLength: 0
    });
    expect(ev.blockers).not.toContain("CPU_HIGH");
    expect(gov.snapshot({
      activeRuntimes: 0,
      activeTikTokWorkers: 0,
      activeBrowserContexts: 0,
      aiQueueLength: 0
    }).cpuLoadPercent).toBe("UNKNOWN");
  });

  it("blocks when mocked CPU is critically high", () => {
    const gov = createMockResourceGovernor({
      maxRuntimes: 99,
      cpuLoadPercent: 99,
      ramAvailableMb: 4096
    });
    const ev = gov.evaluateStart({
      activeRuntimes: 0,
      activeTikTokWorkers: 0,
      activeBrowserContexts: 0,
      aiQueueLength: 0
    });
    expect(ev.blockers).toContain("CPU_HIGH");
  });
});
