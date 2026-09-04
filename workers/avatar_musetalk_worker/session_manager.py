"""
MuseTalkSessionManager — one Python process, many avatar sessions.

Per-session audio queues + fair global GPU scheduler (round-robin).
Does not spawn one PyTorch process per account.
"""
from __future__ import annotations

import asyncio
import os
import time
import uuid
from collections import deque
from dataclasses import dataclass, field
from typing import Any, Deque, Optional

from metrics import MetricsStore
from preprocess_cache import PreprocessCache


@dataclass
class _QueuedAudio:
    path: str
    enqueued_at: float
    done: asyncio.Future[dict[str, Any]]


@dataclass
class SessionState:
    provider_session_id: str
    account_id: str
    session_id: str
    avatar_id: str
    queue: Deque[_QueuedAudio] = field(default_factory=deque)
    status: str = "idle"


class MuseTalkSessionManager:
    def __init__(self, *, metrics: MetricsStore, engine_mode: str = "mock") -> None:
        self.metrics = metrics
        self.engine_mode = engine_mode
        self._sessions: dict[str, SessionState] = {}
        self._cache: Optional[PreprocessCache] = None
        self._model_dir: str = ""
        self._engine_ready = False
        self._rr: list[str] = []
        self._rr_idx = 0
        self._pump_task: Optional[asyncio.Task[None]] = None
        self._lock = asyncio.Lock()

    def bind_cache(self, cache: PreprocessCache) -> None:
        self._cache = cache

    def ensure_engine(self, *, model_dir: str) -> None:
        self._model_dir = model_dir
        os.makedirs(model_dir, exist_ok=True)
        if self.engine_mode == "real":
            models = os.path.join(model_dir, "models")
            if not os.path.isdir(models):
                raise FileNotFoundError(
                    "MuseTalk models missing under modelDir/models — "
                    "install upstream weights manually (no auto-download)"
                )
            # ponytail: ceiling — real torch load not wired in spike; upgrade = import musetalk.
        self._engine_ready = True

    def active_count(self) -> int:
        return len(self._sessions)

    def start(self, *, account_id: str, session_id: str, avatar_id: str) -> dict[str, Any]:
        if not self._engine_ready:
            raise RuntimeError("engine not ready")
        if self._cache is None or self._cache.get(avatar_id) is None:
            raise KeyError(f"avatar preprocess missing: {avatar_id}")
        for s in list(self._sessions.values()):
            if s.account_id == account_id and s.status != "stopped":
                self.stop(s.provider_session_id)
                break
        psid = f"mt_{uuid.uuid4().hex[:12]}"
        state = SessionState(
            provider_session_id=psid,
            account_id=account_id,
            session_id=session_id,
            avatar_id=avatar_id,
        )
        self._sessions[psid] = state
        if psid not in self._rr:
            self._rr.append(psid)
        return {
            "providerSessionId": psid,
            "accountId": account_id,
            "sessionId": session_id,
            "avatarId": avatar_id,
            "status": "idle",
        }

    def stop(self, provider_session_id: str) -> None:
        sess = self._sessions.pop(provider_session_id, None)
        if sess:
            sess.status = "stopped"
            while sess.queue:
                item = sess.queue.popleft()
                if not item.done.done():
                    item.done.set_exception(RuntimeError("session stopped"))
        self._rr = [x for x in self._rr if x != provider_session_id]

    async def push_audio(self, provider_session_id: str, audio_path: str) -> dict[str, Any]:
        sess = self._sessions.get(provider_session_id)
        if not sess:
            raise KeyError("session not found")
        loop = asyncio.get_running_loop()
        item = _QueuedAudio(
            path=audio_path,
            enqueued_at=time.perf_counter(),
            done=loop.create_future(),
        )
        async with self._lock:
            sess.queue.append(item)
            sess.status = "speaking"
        await self._ensure_pump()
        return await item.done

    async def _ensure_pump(self) -> None:
        if self._pump_task and not self._pump_task.done():
            return
        self._pump_task = asyncio.create_task(self._gpu_pump())

    async def _gpu_pump(self) -> None:
        """Global GPU scheduler: round-robin so A cannot starve B."""
        while True:
            job = await self._next_job()
            if job is None:
                return
            psid, item = job
            waited_ms = (time.perf_counter() - item.enqueued_at) * 1000.0
            t0 = time.perf_counter()
            try:
                await self._infer(item.path)
                infer_ms = (time.perf_counter() - t0) * 1000.0
                final_ms = infer_ms * 1.05
                vram, util = self._sample_gpu()
                self.metrics.record_job(
                    infer_ms=infer_ms,
                    final_ms=final_ms,
                    queue_delay_ms=waited_ms,
                    vram_mb=vram,
                    gpu_util=util,
                )
                if not item.done.done():
                    item.done.set_result(
                        {
                            "providerSessionId": psid,
                            "queueDelayMs": round(waited_ms, 1),
                            "inferMs": round(infer_ms, 1),
                        }
                    )
            except Exception as exc:  # noqa: BLE001
                if not item.done.done():
                    item.done.set_exception(exc)
            async with self._lock:
                sess = self._sessions.get(psid)
                if sess and not sess.queue:
                    sess.status = "idle"

    async def _next_job(self) -> tuple[str, _QueuedAudio] | None:
        async with self._lock:
            if not self._rr:
                return None
            n = len(self._rr)
            for _ in range(n):
                if not self._rr:
                    return None
                self._rr_idx %= len(self._rr)
                psid = self._rr[self._rr_idx]
                self._rr_idx = (self._rr_idx + 1) % len(self._rr)
                sess = self._sessions.get(psid)
                if sess and sess.queue:
                    return psid, sess.queue.popleft()
            return None

    async def _infer(self, audio_path: str) -> None:
        size = max(1, os.path.getsize(audio_path))
        delay = 0.02 if self.engine_mode == "mock" else 0.04
        delay += min(0.01, size / 5_000_000)
        await asyncio.sleep(delay)

    def _sample_gpu(self) -> tuple[float, float]:
        if self.engine_mode == "mock":
            return 0.0, 0.0
        # ponytail: ceiling — pynvml optional; upgrade = real VRAM/util sampling.
        return 0.0, 0.0
