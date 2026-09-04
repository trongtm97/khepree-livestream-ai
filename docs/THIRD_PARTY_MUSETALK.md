# Third-party: MuseTalk (local Windows spike)

Khepree may talk to MuseTalk via a **separate Python sidecar** (`workers/avatar_musetalk_worker/`).  
PyTorch / MuseTalk weights are **never** loaded inside the Electron main or renderer process.

Upstream: https://github.com/TMElyralab/MuseTalk  
Paper: https://arxiv.org/abs/2410.10122  
Weights: https://huggingface.co/TMElyralab/MuseTalk

## Upstream license

- **License:** MIT  
- **Copyright:** Tencent Music Entertainment Group (2024) and dependencies listed in upstream LICENSE (VAE, Whisper, etc.)

Retain MIT notices if you redistribute MuseTalk source or binaries.

## What Khepree does / does not do

| Does | Does not |
|------|----------|
| HTTP adapter + session manager sidecar | Bundle MuseTalk into the installer |
| Cache preprocess under user model dir | Auto-download multi‑GB models on app start |
| Benchmark FPS → DEGRADED if &lt; 25 | Claim production-ready without GPU benchmark |
| Fall back to voice-only when avatar not ready | Hard-code RTX SKU marketing names as tiers |

## Attribution

When shipping features that depend on MuseTalk, credit TMElyralab / Tencent Music Entertainment per MIT terms and their README citation preferences.

## Commercial note

Operator installs models under `%APPDATA%` or a chosen folder. Redistribution of weights may be subject to Hugging Face / upstream terms — review before bundling. This spike ships **no weights**.
