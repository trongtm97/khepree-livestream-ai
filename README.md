# Khepree Livestream AI

Windows desktop app that helps one human operator run **one or many** TikTok commerce livestreams with AI assistance.

**Product philosophy:** human-supervised autonomy. AI handles repetitive work; the operator can approve, edit, cancel, or take over at any time.

**Current milestone:** Development **0.2.x** (multi-live core wired). package version remains `0.1.0` until a deliberate release.

## What works in this milestone

- Secure Electron process boundary + typed preload API.
- React operator UI with VI/EN i18n, Live Center, Account Detail, help, errors/toasts.
- Local SQLite multi-live model (accounts, settings, sessions, events, approvals, products).
- Per-account live runtimes, TikTok connectors, LIVE Manager profiles.
- Comment feed + approval queue isolation across accounts.
- Fair AI request scheduler + license/hardware capacity gates.
- Gemini Web + TikTokLive Python sidecars (replaceable adapters).
- Vitest release-blocker suite + GitHub Actions CI.

## First run

```bash
npm install
copy .env.example .env
npm run doctor
npm run typecheck
npm test
npm run test:foundation
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
| `npm run test:legacy:*` | Original assert self-checks (still kept) |

## Data location

`%APPDATA%\KhepreeLivestreamAI\` — `data/app.sqlite`, `secrets/`, `browser-profiles/`, `logs/`, `diagnostics/`.

## Important honesty

This is **not** a production claim. Real TikTok, Gemini, Khepree production lease, and Windows installer smoke are **not** validated yet. Reverse-engineered web connectors can break; they stay behind replaceable adapters.

See `docs/PROJECT_STATE.md`, `docs/FEATURE_MATRIX.md`, `docs/MULTI_LIVE_ARCHITECTURE.md`.
