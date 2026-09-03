# AGENTS.md — Khepree Livestream AI

This repository is intentionally designed for iterative development by AI coding agents.

## Non-negotiable architecture rules

1. Never put Google/TikTok/Khepree secrets in the renderer.
2. Renderer may communicate only through typed preload APIs.
3. Gemini Web API and TikTokLive remain replaceable sidecars/adapters.
4. No LLM output may directly click TikTok or speak on stream.
5. Every AI action must produce an `ActionProposal`, pass policy/rule validation, then pass the Approval Engine.
6. `SUPERVISED_AUTO` is the default operating mode.
7. Production Khepree access is fail-closed.
8. Do not hard-code TikTok DOM selectors into business logic. Keep selector packs in the TikTok connector.
9. Product facts come from Product DNA/local product records. Never let the model invent price, sizes, stock, shipping, warranty, or regulated claims.
10. Any long-running process must have health, timeout, restart, and operator-visible diagnostics.

## Main extension points

- `src/main/connectors/llm/`
- `src/main/connectors/tiktok/`
- `src/main/connectors/media/`
- `src/main/live/`
- `workers/gemini_worker/`
- `workers/tiktok_worker/`

Before changing architecture, read `docs/ARCHITECTURE.md`.
