# MuseTalk local Windows sidecar (spike)

Optional avatar engine for Khepree. **Not production-ready** until you run a real GPU benchmark (`inferFPS` ≥ 25).

- Upstream: https://github.com/TMElyralab/MuseTalk (MIT)
- Docs: `docs/THIRD_PARTY_MUSETALK.md`, `docs/MUSETALK_LOCAL.md`
- Default mode: `KHEPREE_MUSETALK_ENGINE=mock` (no CUDA)

## Run (mock)

```bash
cd workers/avatar_musetalk_worker
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
set KHEPREE_WORKER_TOKEN=devtoken
set KHEPREE_MUSETALK_ENGINE=mock
python app.py --port 8765
```

Models live under `%APPDATA%\khepree-livestream-ai\musetalk-models` (or a user-selected folder). **Never** inside Electron `asar`.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Status + metrics summary |
| POST | `/initialize` | Bind modelDir + one-time preprocess |
| POST | `/session/start` | Map Khepree account → provider session |
| POST | `/session/audio` | Push Khepree TTS WAV path |
| POST | `/session/stop` | End session |
| GET | `/metrics` | inferFPS, finalFPS, VRAM, util, queue delay |

Auth: `Authorization: Bearer $KHEPREE_WORKER_TOKEN`
