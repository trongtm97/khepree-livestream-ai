# MuseTalk local Windows setup (spike)

**Status:** experimental sidecar. Do **not** treat as production-ready until a real GPU run shows `inferFPS` ≥ 25 and health is not `DEGRADED`.

## Architecture

```
Khepree TTS WAV ──┬──► AudioOutput (virtual cable)
                  └──► MuseTalkLocalProvider ──HTTP──► avatar_musetalk_worker (Python)
                                                              │
                                                              ├── MuseTalkSessionManager
                                                              ├── per-session queues
                                                              └── fair GPU scheduler
```

One worker process can host multiple account sessions. Do **not** spawn five heavy PyTorch processes by default.

## 1. Install worker (mock first)

```powershell
cd workers\avatar_musetalk_worker
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
$env:KHEPREE_WORKER_TOKEN = "devtoken"
$env:KHEPREE_MUSETALK_ENGINE = "mock"
python app.py --port 8765
```

## 2. Model directory

Preferred: `%APPDATA%\khepree-livestream-ai\musetalk-models`  
Or pick a folder in the **Thiết lập engine nhân vật** wizard.

Layout (operator-managed):

```
musetalk-models/
  models/          # upstream weights (manual download)
  preprocess_cache/
    <avatarId>/
      metadata.json
      face_coordinates.json
      latents.stub
```

Never store models inside the Electron `asar`.

## 3. Real MuseTalk (manual)

1. Clone https://github.com/TMElyralab/MuseTalk and install CUDA torch in the **worker** venv.  
2. Download weights yourself (no auto-download from Khepree).  
3. `KHEPREE_MUSETALK_ENGINE=real`  
4. Run wizard preprocess once per source video.  
5. Call `GET /metrics` — if `inferFPS` &lt; 25 → health `DEGRADED` → avatar modes not ready; **voice-only still works**.

## 4. GPU tiers

Tiers (`realtime-high` / `realtime` / `marginal` / `insufficient`) come from **measured FPS**, not GPU product names.

## 5. Khepree UI

Nhân vật & Giọng nói → Engine → **MuseTalk (local)** → open **Thiết lập engine nhân vật**.
