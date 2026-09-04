# Khepree Livestream AI

Windows desktop app that helps one human operator run **one or many** TikTok commerce livestreams with AI assistance.

**Product philosophy:** human-supervised autonomy. AI handles repetitive work; the operator can approve, edit, cancel, or take over at any time.

**Current milestone:** Development **0.3.x** (multi-live + operator hardening + voice). package version remains `0.1.0` until a deliberate release. **Not production-ready.**

## What works in this milestone

- Secure Electron boundary + typed preload + account-aware IPC.
- React operator UI (VI/EN): Live Center, Account Detail, Voice, help, errors/toasts.
- SQLite multi-live model (accounts, settings, sessions, events, approvals, products, media profiles).
- Per-account live runtimes, TikTok connectors, LIVE Manager profiles.
- Comment feed isolation, cross-source event dedupe, approval session binding.
- Session epoch guards + crash recovery (no auto-resume).
- Fair AI request scheduler + license/hardware capacity + Windows resource monitor.
- Voice pipeline: MediaSession + Windows SAPI TTS + local speaker preview (no avatar).
- Human takeover / emergency stop (TikTok stays connected).
- Batch start-ready / stop-all in main process; realtime app events.
- Vitest + CI; DEMO smoke vs gated REAL smoke checklist.

## First run

```bash
npm install
copy .env.example .env
npm run doctor
npm run typecheck
npm test
npm run test:foundation
npm run test:smoke:gate
npm start
```

For Gemini / TikTok worker Python deps:

```bash
python -m venv worker-env
worker-env\Scripts\pip install -r workers/gemini_worker/requirements.txt
worker-env\Scripts\pip install -r workers/tiktok_worker/requirements.txt
```

## Tests

| Script | Purpose |
| --- | --- |
| `npm test` | Full Vitest suite |
| `npm run test:unit` | Unit / contract helpers |
| `npm run test:multi-live` | Multi-live + connectors + comments + scheduler + recovery |
| `npm run test:foundation` | Static architecture/file contracts |
| `npm run test:smoke:demo` | DEMO/MOCK smoke (Vitest subset — CI-safe) |
| `npm run test:smoke:gate` | Assert REAL smoke is gated off without env |
| `KHEPREE_REAL_SMOKE=1 npm run test:smoke:real` | Operator REAL smoke (manual; `docs/REAL_SMOKE_TEST.md`) |
| `npm run test:legacy:*` | Original assert self-checks (still kept) |

## Data location

`%APPDATA%\KhepreeLivestreamAI\` — `data/app.sqlite`, `secrets/`, `browser-profiles/`, `logs/`, `diagnostics/`.

## Important honesty

This is **not** a production claim. Real TikTok, Gemini, Khepree production lease, installer, avatar, and virtual camera/audio are **not** validated as shipping-ready. Reverse-engineered web connectors can break; they stay behind replaceable adapters.

See `docs/PROJECT_STATE.md`, `docs/FEATURE_MATRIX.md`, `docs/MULTI_LIVE_ARCHITECTURE.md`, `docs/REAL_SMOKE_TEST.md`, `docs/REVIEW_NEXT.md`.
