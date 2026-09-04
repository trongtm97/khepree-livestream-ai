# Project state — v0.1.0 foundation

## Implemented

- Desktop scaffold and secure process split.
- Khepree integration contract and client-side access state foundation.
- SQLite data model + `app_meta` settings (UI locale).
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

## Deliberately not claimed production-ready

- Live Khepree cross-system registration/signing key.
- Gemini account/cookie onboarding UI.
- TikTok LIVE Manager selector packs against a real live account.
- LiveTalking/MuseTalk/TTS/virtual camera runtime.
- TikTok order-feed parsing.
- Product importer.
- Policy packs by market.
- Installer smoke on a real Windows host.
- Code signing.
