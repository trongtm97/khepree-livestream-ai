"""Unit checks for MuseTalk worker helpers — no CUDA, no FastAPI required."""
from __future__ import annotations

import asyncio
import os
import tempfile
import unittest

from metrics import MetricsStore, REALTIME_FPS_TARGET
from preprocess_cache import PreprocessCache
from session_manager import MuseTalkSessionManager


class PreprocessCacheTests(unittest.TestCase):
    def test_cache_hit_skips_rewrite(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            video = os.path.join(tmp, "src.mp4")
            with open(video, "wb") as f:
                f.write(b"video")
            cache = PreprocessCache(os.path.join(tmp, "cache"))
            first = cache.ensure(avatar_id="av1", source_video_path=video)
            second = cache.ensure(avatar_id="av1", source_video_path=video)
            self.assertFalse(first.get("cacheHit"))
            self.assertTrue(second.get("cacheHit"))
            self.assertEqual(first["fingerprint"], second["fingerprint"])


class MetricsTests(unittest.TestCase):
    def test_tier_from_fps_not_sku_name(self) -> None:
        m = MetricsStore()
        # 20ms infer → 50 FPS → realtime-high
        for _ in range(10):
            m.record_job(infer_ms=20, final_ms=21, queue_delay_ms=1)
        snap = m.snapshot()
        self.assertGreaterEqual(snap["inferFPS"], REALTIME_FPS_TARGET)
        self.assertIn(snap["gpuTier"], ("realtime", "realtime-high"))
        self.assertTrue(snap["realtimeOk"])


class SessionFairnessTests(unittest.IsolatedAsyncioTestCase):
    async def test_round_robin_does_not_starve_b(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            video = os.path.join(tmp, "src.mp4")
            with open(video, "wb") as f:
                f.write(b"v")
            cache = PreprocessCache(os.path.join(tmp, "cache"))
            cache.ensure(avatar_id="av", source_video_path=video)
            mgr = MuseTalkSessionManager(metrics=MetricsStore(), engine_mode="mock")
            mgr.bind_cache(cache)
            mgr.ensure_engine(model_dir=tmp)
            a = mgr.start(account_id="acc_a", session_id="s1", avatar_id="av")
            b = mgr.start(account_id="acc_b", session_id="s2", avatar_id="av")
            wav_a = os.path.join(tmp, "a.wav")
            wav_b = os.path.join(tmp, "b.wav")
            with open(wav_a, "wb") as f:
                f.write(b"aaaa")
            with open(wav_b, "wb") as f:
                f.write(b"bbbb")
            # Enqueue multiple A then B — fair RR should still finish B.
            results = await asyncio.gather(
                mgr.push_audio(a["providerSessionId"], wav_a),
                mgr.push_audio(a["providerSessionId"], wav_a),
                mgr.push_audio(b["providerSessionId"], wav_b),
            )
            self.assertEqual(len(results), 3)
            mgr.stop(a["providerSessionId"])
            # B still present until stopped
            self.assertIn(b["providerSessionId"], mgr._sessions)


if __name__ == "__main__":
    unittest.main()
