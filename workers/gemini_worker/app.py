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
AUTH_MODE: Optional[str] = None


def require_auth(authorization: str | None) -> None:
    if not TOKEN or authorization != f"Bearer {TOKEN}":
        raise HTTPException(status_code=401, detail="unauthorized")


def classify_error(message: str) -> str:
    lower = message.lower()
    if any(x in lower for x in ("quota", "rate limit", "429", "resource exhausted", "hết hạn mức")):
        return "QUOTA_EXCEEDED"
    if any(x in lower for x in ("auth", "login", "cookie", "401", "403", "expired", "sign in")):
        return "REAUTH_REQUIRED"
    return "CONNECTOR_ERROR"


def export_cookies(client: Any) -> dict[str, str | None]:
    """Best-effort cookie export for main-process encrypted storage. Never for renderer."""
    secure1PSID = (
        getattr(client, "secure_1psid", None)
        or getattr(client, "secure1PSID", None)
        or getattr(client, "psid", None)
    )
    secure1PSIDTS = (
        getattr(client, "secure_1psidts", None)
        or getattr(client, "secure1PSIDTS", None)
        or getattr(client, "psidts", None)
    )
    cookies = getattr(client, "cookies", None)
    if isinstance(cookies, dict):
        secure1PSID = secure1PSID or cookies.get("Secure_1PSID") or cookies.get("__Secure-1PSID")
        secure1PSIDTS = secure1PSIDTS or cookies.get("Secure_1PSIDTS") or cookies.get("__Secure-1PSIDTS")
    return {
        "secure1PSID": str(secure1PSID) if secure1PSID else None,
        "secure1PSIDTS": str(secure1PSIDTS) if secure1PSIDTS else None,
    }


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
    phase = "READY" if READY else ("CONNECTOR_ERROR" if LAST_ERROR else "NOT_SIGNED_IN")
    if LAST_ERROR:
        phase = classify_error(LAST_ERROR)
        if not READY and phase == "CONNECTOR_ERROR" and GeminiClient is None:
            phase = "CONNECTOR_ERROR"
        elif not READY and phase not in ("QUOTA_EXCEEDED", "REAUTH_REQUIRED"):
            phase = "NOT_SIGNED_IN" if GeminiClient is not None else "CONNECTOR_ERROR"
    return {
        "ok": True,
        "ready": READY,
        "dependencyInstalled": GeminiClient is not None,
        "authMode": AUTH_MODE,
        "phase": phase if GeminiClient is not None or READY else "CONNECTOR_ERROR",
        "message": LAST_ERROR or ("ready" if READY else "not initialized"),
        "ts": time.time(),
    }


@APP.post("/v1/init")
async def init_client(
    body: InitRequest, authorization: str | None = Header(default=None)
) -> dict[str, Any]:
    global CLIENT, READY, LAST_ERROR, AUTH_MODE
    require_auth(authorization)
    if GeminiClient is None:
        LAST_ERROR = "gemini_webapi is not installed"
        READY = False
        raise HTTPException(status_code=503, detail=LAST_ERROR)

    try:
        AUTH_MODE = body.authMode
        if body.authMode == "browser":
            CLIENT = GeminiClient()
        else:
            if not body.secure1PSID:
                raise ValueError("secure1PSID is required for cookie auth")
            CLIENT = GeminiClient(body.secure1PSID, body.secure1PSIDTS or "")
        await CLIENT.init(timeout=30, auto_close=False, close_delay=300, auto_refresh=True)
        READY = True
        LAST_ERROR = None
        cookies = export_cookies(CLIENT)
        return {"ok": True, "cookies": cookies}
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
    global LAST_ERROR, READY
    require_auth(authorization)
    if not READY or CLIENT is None:
        raise HTTPException(status_code=503, detail="not initialized")
    try:
        response = await CLIENT.generate_content(
            body.prompt,
            model=body.model,
            temporary=body.temporary,
        )
        LAST_ERROR = None
        return {
            "text": getattr(response, "text", str(response)),
            "model": body.model,
        }
    except Exception as exc:
        LAST_ERROR = f"{type(exc).__name__}: {exc}"
        detail = LAST_ERROR
        code = 502
        if classify_error(LAST_ERROR) == "QUOTA_EXCEEDED":
            code = 429
        if classify_error(LAST_ERROR) == "REAUTH_REQUIRED":
            READY = False
            code = 401
        raise HTTPException(status_code=code, detail=detail)


@APP.post("/v1/shutdown-client")
async def shutdown_client(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    global CLIENT, READY, LAST_ERROR, AUTH_MODE
    require_auth(authorization)
    CLIENT = None
    READY = False
    AUTH_MODE = None
    LAST_ERROR = None
    return {"ok": True}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, required=True)
    args = parser.parse_args()
    uvicorn.run(APP, host="127.0.0.1", port=args.port, log_level="warning")


if __name__ == "__main__":
    main()
