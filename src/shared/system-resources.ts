/** Public resource metrics shared with renderer (no secrets). */
export type ResourceMetric = number | "UNKNOWN";

export type GpuVendor = "NVIDIA" | "AMD" | "INTEL" | "UNKNOWN";

/**
 * GPU adapter snapshot.
 * UNKNOWN when not measurable — never invent VRAM / utilization.
 */
export type GpuSnapshot =
  | "UNKNOWN"
  | {
      vendor: GpuVendor;
      name?: string;
      available: boolean;
      utilizationPercent?: ResourceMetric;
      vramTotalMb?: ResourceMetric;
      vramUsedMb?: ResourceMetric;
      vramFreeMb?: ResourceMetric;
    };

/** Operator-facing machine metrics (subset of ResourceGovernor snapshot). */
export type SystemResourcePublicSnapshot = {
  checkedAt: string;
  cpuLoadPercent: ResourceMetric;
  ramAvailableMb: ResourceMetric;
  ramUsedPercent: ResourceMetric;
  gpu: GpuSnapshot;
};
