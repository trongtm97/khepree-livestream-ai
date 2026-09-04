# LiveTalking external server setup (no bundle)

Khepree drives avatar lips with **its own TTS WAV** via LiveTalking `POST /humanaudio`.  
LiveTalking runs on a **separate machine/VM** (typically Ubuntu + NVIDIA GPU).

Do **not** expect this Electron app to install CUDA models or run `app.py` in-process on Windows.

## 1. Operator machine (GPU)

Follow upstream install (Ubuntu 22.04 / CUDA as documented):

https://github.com/lipku/LiveTalking

```bash
git clone https://github.com/lipku/LiveTalking.git
# conda / pip + torch CUDA — see upstream README
cd LiveTalking
# Download models yourself (multi-GB). Khepree will not download them.
python app.py --transport webrtc --model wav2lip --avatar_id wav2lip256_avatar1
```

Notes from upstream:

- Open TCP **8010** (default listen) and the UDP range they document for WebRTC.
- `--transport virtualcam` for virtual camera output into OBS / TikTok LIVE Manager.
- Multi-concurrency: each WebRTC `/offer` gets its own `sessionid` — map **one Khepree account → one LiveTalking session**. Never share sessions across shops.

## 2. Khepree Advanced settings

On **Nhân vật & Giọng nói** → Engine nhân vật AI → **LiveTalking**:

| Field | Example |
|-------|---------|
| serverUrl | `http://192.168.1.50:8010` |
| avatarId | `wav2lip256_avatar1` |
| model | `wav2lip` (informational; server started with `--model`) |
| transport | `webrtc` / `virtualcam` / `rtmp` (server-side mode) |
| connectionTimeout | `8000` ms |

Basic UI only shows: **Máy nhân vật AI đã kết nối / chưa kết nối** (probe).

## 3. Speech path

1. Khepree Approval Engine allows a `SPEAK` action.  
2. Khepree TTS writes a WAV.  
3. Same WAV → local/virtual **AudioOutput** and `POST /humanaudio` (multipart `sessionid` + `file`).  
4. LiveTalking renders lips; Khepree does **not** use `/human` chat/LLM or LiveTalking TTS for that utterance.

## 4. Session mapping

| Khepree | LiveTalking |
|---------|-------------|
| accountId A + sessionId A1 | provider session X from `POST /offer` |
| accountId B + sessionId B1 | provider session Y (separate `/offer`) |

Stop A must not interrupt Y.

## 5. Smoke (manual)

1. Open `http://<server>:8010/index.html` — confirm avatar preview.  
2. In Khepree, save LiveTalking settings → probe shows connected.  
3. Start live in `AVATAR_PREVIEW` / `AVATAR_LIVE` when readiness allows.  
4. Approve a speak line — lips move on LiveTalking output; TikTok hears Khepree audio route.

## 6. License / watermark

Read [THIRD_PARTY_LIVETALKING.md](./THIRD_PARTY_LIVETALKING.md). Upstream asks for LiveTalking watermark on published videos. Commercial redistribution of LiveTalking itself is out of scope until reviewed — **no auto-download, no bundle**.
