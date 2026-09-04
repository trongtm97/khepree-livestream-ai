"""Benchmark / health metrics for MuseTalk sidecar (spike)."""
from __future__ import annotations

import threading
import time
from collections import deque
from typing import Any

REALTIME_FPS_TARGET = 25.0


class MetricsStore:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._infer_times: deque[float] = deque(maxlen=120)
        self._final_times: deque[float] = deque(maxlen=120)
        self._queue_delays_ms: deque[float] = deque(maxlen=120)
        self._vram_mb: float = 0.0
        self._gpu_util: float = 0.0
        self._tier: str = "unknown"  # derived from benchmark, not GPU marketing name

    def record_job(
        self,
        *,
        infer_ms: float,
        final_ms: float,
        queue_delay_ms: float,
        vram_mb: float | None = None,
        gpu_util: float | None = None,
    ) -> None:
        with self._lock:
            if infer_ms > 0:
                self._infer_times.append(infer_ms / 1000.0)
            if final_ms > 0:
                self._final_times.append(final_ms / 1000.0)
            self._queue_delays_ms.append(queue_delay_ms)
            if vram_mb is not None:
                self._vram_mb = vram_mb
            if gpu_util is not None:
                self._gpu_util = gpu_util
            self._tier = self._derive_tier_locked()

    def _fps_from(self, samples: deque[float]) -> float:
        if not samples:
            return 0.0
        avg = sum(samples) / len(samples)
        if avg <= 0:
            return 0.0
        return 1.0 / avg

    def _derive_tier_locked(self) -> str:
        """GPU tier from measured FPS — never hard-code RTX SKU names."""
        fps = self._fps_from(self._infer_times)
        if fps <= 0:
            return "unbenchmarked"
        if fps >= REALTIME_FPS_TARGET * 1.4:
            return "realtime-high"
        if fps >= REALTIME_FPS_TARGET:
            return "realtime"
        if fps >= REALTIME_FPS_TARGET * 0.7:
            return "marginal"
        return "insufficient"

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            infer_fps = self._fps_from(self._infer_times)
            final_fps = self._fps_from(self._final_times)
            q = list(self._queue_delays_ms)
            queue_delay = sum(q) / len(q) if q else 0.0
            realtime_ok = infer_fps >= REALTIME_FPS_TARGET if self._infer_times else False
            return {
                "inferFPS": round(infer_fps, 2),
                "finalFPS": round(final_fps, 2),
                "vramMb": round(self._vram_mb, 1),
                "gpuUtilization": round(self._gpu_util, 1),
                "queueDelayMs": round(queue_delay, 1),
                "realtimeOk": realtime_ok,
                "gpuTier": self._tier,
                "sampledJobs": len(self._infer_times),
                "checkedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            }
