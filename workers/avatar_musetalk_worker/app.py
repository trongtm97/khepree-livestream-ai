"""
Khepree MuseTalk local Windows sidecar (spike).

Does NOT embed MuseTalk weights or download models on import.
Real inference is optional: set KHEPREE_MUSETALK_ENGINE=real after operator install.
Default / CI: mock engine (no CUDA).

Upstream: https://github.com/TMElyralab/MuseTalk (MIT) — see docs/THIRD_PARTY_MUSETALK.md
"""
from __future__ import annotations

import argparse
import os
import time
from typing import Any, Optional

import uvicorn
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from metrics import MetricsStore, REALTIME_FPS_TARGET
from preprocess_cache import PreprocessCache
from session_manager import MuseTalkSessionManager

APP = FastAPI(title="Khepree MuseTalk Worker", docs_url=None, redoc_url=None)
TOKEN = os.environ.get("KHEPREE_WORKER_TOKEN", "")
MODEL_DIR = os.environ.get("KHEPREE_MUSETALK_MODEL_DIR", "")
CACHE_DIR = os.environ.get("KHEPREE_MUSETALK_CACHE_DIR", "")
ENGINE_MODE = os.environ.get("KHEPREE_MUSETALK_ENGINE", "mock").strip().lower()

METRICS = MetricsStore()
SESSIONS = MuseTalkSessionManager(metrics=METRICS, engine_mode=ENGINE_MODE)
INITIALIZED = False
LAST_ERROR: Optional[str] = None


def require_auth(authorization: str | None) -> None:
    if not TOKEN or authorization != f"Bearer {TOKEN}":
        raise HTTPException(status_code=401, detail="unauthorized")


class InitializeBody(BaseModel):
    modelDir: str = Field(default="")
    cacheDir: str = Field(default="")
    avatarId: str
    sourceVideoPath: str
    forcePreprocess: bool = False


class SessionStartBody(BaseModel):
    accountId: str
    sessionId: str
    avatarId: str


class SessionAudioBody(BaseModel):
    providerSessionId: str
    audioPath: str


class SessionStopBody(BaseModel):
    providerSessionId: str


@APP.get("/health")
async def health(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    require_auth(authorization)
    snap = METRICS.snapshot()
    realtime_ok = snap.get("realtimeOk", False)
    if LAST_ERROR:
        status = "DOWN"
        message = LAST_ERROR
    elif not INITIALIZED:
        status = "LOADING"
        message = f"not initialized; engine={ENGINE_MODE}"
    elif not realtime_ok and snap.get("inferFPS", 0) > 0:
        status = "DEGRADED"
        message = f"below realtime target ({REALTIME_FPS_TARGET} FPS); infer={snap.get('inferFPS')}"
    elif INITIALIZED:
        status = "READY" if realtime_ok or snap.get("inferFPS", 0) == 0 else "DEGRADED"
        message = f"engine={ENGINE_MODE}; sessions={SESSIONS.active_count()}"
    else:
        status = "DOWN"
        message = "unknown"
    return {
        "status": status,
        "message": message,
        "engineMode": ENGINE_MODE,
        "initialized": INITIALIZED,
        "productionReady": False,  # spike — never claim ready before operator benchmark
        "realtimeTargetFps": REALTIME_FPS_TARGET,
        "metrics": snap,
        "checkedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


@APP.post("/initialize")
async def initialize(
    body: InitializeBody, authorization: str | None = Header(default=None)
) -> dict[str, Any]:
    require_auth(authorization)
    global INITIALIZED, LAST_ERROR, MODEL_DIR, CACHE_DIR
    try:
        model_dir = (body.modelDir or MODEL_DIR or "").strip()
        cache_dir = (body.cacheDir or CACHE_DIR or "").strip()
        if not model_dir:
            raise HTTPException(status_code=400, detail="modelDir required")
        if not cache_dir:
            cache_dir = os.path.join(model_dir, "preprocess_cache")
        if not os.path.isfile(body.sourceVideoPath):
            raise HTTPException(status_code=400, detail="sourceVideoPath missing")

        MODEL_DIR = model_dir
        CACHE_DIR = cache_dir
        cache = PreprocessCache(cache_dir)
        meta = cache.ensure(
            avatar_id=body.avatarId,
            source_video_path=body.sourceVideoPath,
            force=body.forcePreprocess,
        )
        SESSIONS.bind_cache(cache)
        # Mock/real engine loads weights here — never from Electron main.
        SESSIONS.ensure_engine(model_dir=model_dir)
        INITIALIZED = True
        LAST_ERROR = None
        return {"ok": True, "preprocess": meta, "engineMode": ENGINE_MODE}
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        LAST_ERROR = str(exc)
        INITIALIZED = False
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@APP.post("/session/start")
async def session_start(
    body: SessionStartBody, authorization: str | None = Header(default=None)
) -> dict[str, Any]:
    require_auth(authorization)
    if not INITIALIZED:
        raise HTTPException(status_code=409, detail="not initialized")
    try:
        sess = SESSIONS.start(
            account_id=body.accountId,
            session_id=body.sessionId,
            avatar_id=body.avatarId,
        )
        return {"ok": True, "session": sess}
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@APP.post("/session/audio")
async def session_audio(
    body: SessionAudioBody, authorization: str | None = Header(default=None)
) -> dict[str, Any]:
    require_auth(authorization)
    if not os.path.isfile(body.audioPath):
        raise HTTPException(status_code=400, detail="audioPath missing")
    try:
        result = await SESSIONS.push_audio(body.providerSessionId, body.audioPath)
        return {"ok": True, **result}
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@APP.post("/session/stop")
async def session_stop(
    body: SessionStopBody, authorization: str | None = Header(default=None)
) -> dict[str, Any]:
    require_auth(authorization)
    SESSIONS.stop(body.providerSessionId)
    return {"ok": True}


@APP.get("/metrics")
async def metrics(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    require_auth(authorization)
    snap = METRICS.snapshot()
    return {
        "ok": True,
        "productionReady": False,
        "realtimeTargetFps": REALTIME_FPS_TARGET,
        **snap,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--host", default="127.0.0.1")
    args = parser.parse_args()
    uvicorn.run(APP, host=args.host, port=args.port, log_level="info")


if __name__ == "__main__":
    main()
