# Project state — v0.1.0 foundation

> Xem `docs/CODE_REVIEW.md` để biết đánh giá mã nguồn chi tiết, các lỗi đã phát hiện và cách khắc phục.

## Implemented

- Desktop scaffold and secure process split.
- Khepree integration contract and client-side access state foundation.
- SQLite data model + `app_meta` settings (UI locale, voice, voice mute state).
- Event bus.
- Sales state machine.
- Comment priority scorer.
- Approval queue/timer logic.
- Live Orchestrator.
- Gemini Web API worker.
- TikTokLive event worker.
- LIVE Manager Playwright observer scaffold.
- Operator dashboard with **modular renderer UI** (`src/renderer/app`, `pages/`, `components/`) and VI/EN i18n.
- Seller-facing navigation (Overview → Help), first-run onboarding, and **in-app help** (micro tips, page guides, searchable offline Help Center).
- Seller-facing **error dialog + toast** feedback (`src/shared/errors`, `src/renderer/errors`) with VI/EN catalog; no `alert()` in production UI.
- **Pre-livestream readiness checklist** (READY / WARNING / BLOCKING) with per-item CTAs and Start Live gate explanation.
- Development mock LLM/media connectors.
- Worker health management.
- **System text-to-speech** (Windows SAPI / macOS `say` / Linux espeak) behind `MediaManager`, with a speech queue, utterance length cap, and an operator voice kill-switch for human takeover.
- **Emergency stop** — silences audio, discards pending proposals, drops to `MANUAL_ASSIST`, keeps the stream on air.
- **Livestream history** — reads back the persisted sessions/events/approvals so an operator can review what the AI did after a stream.
- **Test suite** — Vitest, 74 tests over the approval engine, orchestrator, event bus, media manager, and session history SQL.

## Reliability fixes over the original foundation

- Approval queue is now memory- and CPU-bounded (was an unbounded `Map` that degraded every UI snapshot).
- Event bus isolates subscriber failures (a throwing subscriber used to crash the Electron main process).
- Approval resolution is idempotent (a late operator click no longer surfaces as an error dialog).
- Sessions no longer carry stale approvals; `final_state` records the state the session actually ended in.
- Renderer polling is adaptive and failure-tolerant (backoff, hidden-window pause).
- `npm run package` / `npm run make` now build — Node builtins were not externalized, so the main bundle was unbuildable.

## Deliberately not claimed production-ready

- Live Khepree cross-system registration/signing key (still `KHEPREE_DEV_MOCK`).
- Gemini account/cookie onboarding flow against a real account.
- TikTok LIVE Manager selector packs against a real live account (foundation pack ships empty selectors).
- LiveTalking/MuseTalk/virtual camera runtime — TTS is implemented, avatar and scene switching are not.
- TikTok order-feed parsing beyond activity signals.
- Policy packs by market.
- Watchdog / stall detection beyond the LLM circuit breaker.
- Installer smoke on a real Windows host.
- Code signing.
