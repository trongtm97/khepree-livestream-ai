# Third-party: LiveTalking (external avatar engine)

Khepree treats [LiveTalking](https://github.com/lipku/LiveTalking) as an **optional external server**.
This repository does **not** vendor, fork, or ship LiveTalking source, models, or Docker images.

Upstream: https://github.com/lipku/LiveTalking  
Docs: https://github.com/lipku/LiveTalking/blob/main/docs/api.md  
Homepage: https://www.livetalking.ai

## Upstream license

- **License:** Apache License 2.0  
- **Copyright notice (upstream appendix):** Copyright [livetalking@lipku]  
- Full text: https://github.com/lipku/LiveTalking/blob/main/LICENSE

Redistribution / derivative works of LiveTalking itself must follow Apache-2.0 (NOTICE retention, license copy, modification notices). Khepree’s HTTP adapter is separable client code that speaks the documented API; it is not a copy of the LiveTalking codebase.

## Attribution

If you redistribute LiveTalking (binaries, forks, or bundled models), retain Apache-2.0 notices and any upstream NOTICE file.

Upstream citation (from their README):

```
@software{livetalking,
  author = {Hengzhong Li},
  title = {LiveTalking: Real-Time Interactive Streaming Digital Human Framework},
  year = {2025},
  publisher = {GitHub},
  url = {https://github.com/lipku/livetalking}
}
```

## README usage / watermark statement

Upstream README (声明) requires that videos developed with this project and published on platforms such as Bilibili, WeChat Channels, Douyin, etc. **carry the LiveTalking watermark/标识**.

Operators who route LiveTalking output into TikTok or other streams must follow that upstream usage statement and any commercial terms they accept from LiveTalking authors. Khepree does not strip or replace that obligation.

## Why we do not bundle

1. **Environment:** LiveTalking is documented primarily for **Ubuntu + CUDA** (e.g. Ubuntu 22.04, Python 3.12, CUDA 12.x). It is **not** assumed production-ready as a native Windows in-process engine inside Electron.
2. **Models:** Avatar/model weights are multi‑GB downloads. Khepree **never auto-downloads** them.
3. **Commercial review:** Bundling or redistributing LiveTalking + models needs a deliberate license/compliance review. Until that review, Khepree only connects to an operator-hosted server via `serverUrl`.

## Integration shape (Khepree)

| Concern | Owner |
|--------|--------|
| Sales / LLM / approvals | Khepree |
| TTS WAV | Khepree |
| Lip-sync render + WebRTC/virtualcam | External LiveTalking |
| `/humanaudio` drive | Khepree `ExternalLiveTalkingProvider` |

Khepree does **not** call LiveTalking `/human` with `type=chat` (their LLM) or rely on their TTS for livestream speech.

## Setup

See [LIVETALKING_EXTERNAL.md](./LIVETALKING_EXTERNAL.md).
