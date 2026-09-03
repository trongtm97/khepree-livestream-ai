from __future__ import annotations

import argparse
import asyncio
import os
import time
import uuid
from collections import deque
from typing import Any

from fastapi import FastAPI, Header, HTTPException, Query
from pydantic import BaseModel
import uvicorn

try:
    from TikTokLive import TikTokLiveClient
    from TikTokLive.events import (
        CommentEvent,
        ConnectEvent,
        DisconnectEvent,
        FollowEvent,
        GiftEvent,
        LikeEvent,
        ShareEvent,
    )
except Exception:
    TikTokLiveClient = None  # type: ignore

APP = FastAPI(title="Khepree TikTok Worker", docs_url=None, redoc_url=None)
TOKEN = os.environ.get("KHEPREE_WORKER_TOKEN", "")
CLIENT: Any = None
CLIENT_TASK: asyncio.Task[Any] | None = None
CONNECTED = False
SEQUENCE = 0
EVENTS: deque[dict[str, Any]] = deque(maxlen=5000)
LAST_ERROR: str | None = None


def require_auth(authorization: str | None) -> None:
    if not TOKEN or authorization != f"Bearer {TOKEN}":
        raise HTTPException(status_code=401, detail="unauthorized")


def add_event(event_type: str, **kwargs: Any) -> None:
    global SEQUENCE
    SEQUENCE += 1
    EVENTS.append({
        "id": str(uuid.uuid4()),
        "sequence": SEQUENCE,
        "type": event_type,
        "source": "tiktoklive",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        **kwargs,
    })


class ConnectRequest(BaseModel):
    uniqueId: str


@APP.get("/health")
async def health(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    require_auth(authorization)
    return {
        "ok": True,
        "connected": CONNECTED,
        "dependencyInstalled": TikTokLiveClient is not None,
        "message": LAST_ERROR or ("connected" if CONNECTED else "worker ready"),
    }


@APP.post("/v1/connect")
async def connect(
    body: ConnectRequest, authorization: str | None = Header(default=None)
) -> dict[str, Any]:
    global CLIENT, CLIENT_TASK, LAST_ERROR
    require_auth(authorization)
    if TikTokLiveClient is None:
        raise HTTPException(status_code=503, detail="TikTokLive is not installed")
    if CLIENT_TASK and not CLIENT_TASK.done():
        raise HTTPException(status_code=409, detail="already connected/connecting")

    unique_id = body.uniqueId.strip()
    if not unique_id:
        raise HTTPException(status_code=400, detail="uniqueId required")
    if not unique_id.startswith("@"):
        unique_id = "@" + unique_id

    CLIENT = TikTokLiveClient(unique_id=unique_id)

    @CLIENT.on(ConnectEvent)
    async def _on_connect(event: Any) -> None:
        global CONNECTED
        CONNECTED = True
        add_event("CONNECT", username=str(getattr(event, "unique_id", unique_id)))

    @CLIENT.on(DisconnectEvent)
    async def _on_disconnect(event: Any) -> None:
        global CONNECTED
        CONNECTED = False
        add_event("DISCONNECT")

    @CLIENT.on(CommentEvent)
    async def _on_comment(event: Any) -> None:
        user = getattr(event, "user", None)
        add_event(
            "COMMENT",
            userId=str(getattr(user, "unique_id", "")) or None,
            username=str(getattr(user, "unique_id", "")) or None,
            displayName=str(getattr(user, "nickname", "")) or None,
            text=str(getattr(event, "comment", "")),
        )

    @CLIENT.on(LikeEvent)
    async def _on_like(event: Any) -> None:
        add_event("LIKE", amount=int(getattr(event, "count", 0) or 0))

    @CLIENT.on(FollowEvent)
    async def _on_follow(event: Any) -> None:
        user = getattr(event, "user", None)
        add_event("FOLLOW", username=str(getattr(user, "unique_id", "")) or None)

    @CLIENT.on(ShareEvent)
    async def _on_share(event: Any) -> None:
        user = getattr(event, "user", None)
        add_event("SHARE", username=str(getattr(user, "unique_id", "")) or None)

    @CLIENT.on(GiftEvent)
    async def _on_gift(event: Any) -> None:
        user = getattr(event, "user", None)
        gift = getattr(event, "gift", None)
        add_event(
            "GIFT",
            username=str(getattr(user, "unique_id", "")) or None,
            text=str(getattr(gift, "name", "")) or None,
            amount=int(getattr(event, "repeat_count", 1) or 1),
        )

    async def runner() -> None:
        global CONNECTED, LAST_ERROR
        try:
            await CLIENT.start()
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            LAST_ERROR = f"{type(exc).__name__}: {exc}"
            add_event("SYSTEM", text=LAST_ERROR)
        finally:
            CONNECTED = False

    CLIENT_TASK = asyncio.create_task(runner())
    LAST_ERROR = None
    return {"ok": True, "uniqueId": unique_id}


@APP.post("/v1/disconnect")
async def disconnect(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    global CLIENT_TASK, CLIENT, CONNECTED
    require_auth(authorization)
    if CLIENT is not None:
        try:
            await CLIENT.disconnect()
        except Exception:
            pass
    if CLIENT_TASK and not CLIENT_TASK.done():
        CLIENT_TASK.cancel()
    CLIENT_TASK = None
    CLIENT = None
    CONNECTED = False
    return {"ok": True}


@APP.get("/v1/events")
async def events(
    after: int = Query(default=0),
    limit: int = Query(default=200, ge=1, le=500),
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    require_auth(authorization)
    rows = [event for event in EVENTS if int(event["sequence"]) > after]
    return {"events": rows[:limit], "lastSequence": SEQUENCE}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, required=True)
    args = parser.parse_args()
    uvicorn.run(APP, host="127.0.0.1", port=args.port, log_level="warning")


if __name__ == "__main__":
    main()
