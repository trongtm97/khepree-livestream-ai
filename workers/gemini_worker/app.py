from __future__ import annotations

import argparse
import os
import time
from typing import Any, Optional

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
import uvicorn

try:
    from gemini_webapi import GeminiClient
except Exception:
    GeminiClient = None  # type: ignore

APP = FastAPI(title="Khepree Gemini Worker", docs_url=None, redoc_url=None)
TOKEN = os.environ.get("KHEPREE_WORKER_TOKEN", "")
CLIENT: Any = None
READY = False
LAST_ERROR: Optional[str] = None


def require_auth(authorization: str | None) -> None:
    if not TOKEN or authorization != f"Bearer {TOKEN}":
        raise HTTPException(status_code=401, detail="unauthorized")


class InitRequest(BaseModel):
    authMode: str = "browser"
    secure1PSID: str | None = None
    secure1PSIDTS: str | None = None


class GenerateRequest(BaseModel):
    prompt: str
    model: str | None = None
    temporary: bool = True


@APP.get("/health")
async def health(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    require_auth(authorization)
    return {
        "ok": True,
        "ready": READY,
        "dependencyInstalled": GeminiClient is not None,
        "message": LAST_ERROR or ("ready" if READY else "not initialized"),
        "ts": time.time(),
    }


@APP.post("/v1/init")
async def init_client(
    body: InitRequest, authorization: str | None = Header(default=None)
) -> dict[str, Any]:
    global CLIENT, READY, LAST_ERROR
    require_auth(authorization)
    if GeminiClient is None:
        LAST_ERROR = "gemini_webapi is not installed"
        raise HTTPException(status_code=503, detail=LAST_ERROR)

    try:
        if body.authMode == "browser":
            CLIENT = GeminiClient()
        else:
            if not body.secure1PSID:
                raise ValueError("secure1PSID is required for cookie auth")
            CLIENT = GeminiClient(body.secure1PSID, body.secure1PSIDTS or "")
        await CLIENT.init(timeout=30, auto_close=False, close_delay=300, auto_refresh=True)
        READY = True
        LAST_ERROR = None
        return {"ok": True}
    except Exception as exc:
        READY = False
        LAST_ERROR = f"{type(exc).__name__}: {exc}"
        raise HTTPException(status_code=503, detail=LAST_ERROR)


@APP.get("/v1/models")
async def models(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    require_auth(authorization)
    if not READY or CLIENT is None:
        raise HTTPException(status_code=503, detail="not initialized")
    output = []
    for model in CLIENT.list_models() or []:
        output.append({
            "name": getattr(model, "model_name", str(model)),
            "displayName": getattr(model, "display_name", str(model)),
            "available": bool(getattr(model, "is_available", True)),
        })
    return {"models": output}


@APP.post("/v1/generate")
async def generate(
    body: GenerateRequest, authorization: str | None = Header(default=None)
) -> dict[str, Any]:
    require_auth(authorization)
    if not READY or CLIENT is None:
        raise HTTPException(status_code=503, detail="not initialized")
    try:
        response = await CLIENT.generate_content(
            body.prompt,
            model=body.model,
            temporary=body.temporary,
        )
        return {
            "text": getattr(response, "text", str(response)),
            "model": body.model,
        }
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"{type(exc).__name__}: {exc}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, required=True)
    args = parser.parse_args()
    uvicorn.run(APP, host="127.0.0.1", port=args.port, log_level="warning")


if __name__ == "__main__":
    main()
