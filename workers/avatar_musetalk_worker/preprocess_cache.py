"""
One-time avatar preprocess cache (face coords / latents / metadata).

Does not re-run preprocess on every live start when cache is warm.
"""
from __future__ import annotations

import hashlib
import json
import os
import time
from typing import Any


class PreprocessCache:
    def __init__(self, root: str) -> None:
        self.root = root
        os.makedirs(self.root, exist_ok=True)

    def _avatar_dir(self, avatar_id: str) -> str:
        safe = "".join(c if c.isalnum() or c in "-_" else "_" for c in avatar_id)
        path = os.path.join(self.root, safe)
        os.makedirs(path, exist_ok=True)
        return path

    def _fingerprint(self, source_video_path: str) -> str:
        st = os.stat(source_video_path)
        raw = f"{source_video_path}|{st.st_size}|{int(st.st_mtime)}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]

    def ensure(
        self, *, avatar_id: str, source_video_path: str, force: bool = False
    ) -> dict[str, Any]:
        adir = self._avatar_dir(avatar_id)
        meta_path = os.path.join(adir, "metadata.json")
        fp = self._fingerprint(source_video_path)
        if not force and os.path.isfile(meta_path):
            with open(meta_path, encoding="utf-8") as f:
                meta = json.load(f)
            if meta.get("fingerprint") == fp and meta.get("ready"):
                meta["cacheHit"] = True
                return meta

        # Spike: write stub latents / face coords — real MuseTalk preprocess plugs here.
        face_path = os.path.join(adir, "face_coordinates.json")
        latents_path = os.path.join(adir, "latents.stub")
        with open(face_path, "w", encoding="utf-8") as f:
            json.dump({"bbox": [0, 0, 256, 256], "center": [128, 128]}, f)
        with open(latents_path, "wb") as f:
            f.write(b"MUSETALK_LATENT_STUB_V1")
        meta = {
            "avatarId": avatar_id,
            "sourceVideoPath": source_video_path,
            "fingerprint": fp,
            "faceCoordinatesPath": face_path,
            "latentsPath": latents_path,
            "ready": True,
            "cacheHit": False,
            "preprocessedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(meta, f, indent=2)
        return meta

    def get(self, avatar_id: str) -> dict[str, Any] | None:
        meta_path = os.path.join(self._avatar_dir(avatar_id), "metadata.json")
        if not os.path.isfile(meta_path):
            return None
        with open(meta_path, encoding="utf-8") as f:
            return json.load(f)
