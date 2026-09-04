# Khepree Livestream AI

Windows desktop app that helps one human operator run **one or many** TikTok commerce livestreams with AI assistance.

**Product philosophy:** human-supervised autonomy. AI handles repetitive work; the operator can approve, edit, cancel, or take over at any time.

**Current milestone:** Development **0.4.x** — media routing + avatar **foundation**. package version remains `0.1.0` until deliberate release after real smoke. **Not production-ready.**

## What works in this milestone

- Secure Electron boundary + typed preload + account-aware IPC.
- React operator UI (VI/EN): Live Center, Account Detail (scene preview + picture/sound check), Voice / avatar hub, help, errors/toasts.
- SQLite multi-live model through schema v8 (accounts, media profiles, avatar assets, output modes, …).
- Per-account live runtimes, TikTok connectors, LIVE Manager profiles.
- Comment feed isolation, cross-source event dedupe, approval session binding.
- Session epoch guards + crash recovery (no auto-resume).
- Fair **AI** request scheduler (Gemini) + separate **GPU** media scheduler (avatar admission).
- License/hardware capacity + Windows resource monitor.
- Voice / avatar foundation: output modes, Windows SAPI TTS, audio endpoint routing, AvatarProvider adapters (LiveTalking external, MuseTalk-local sidecar), avatar library, SceneEngine local preview.
- Media Readiness Center: dry-run livestream (no TikTok) + 3-account token check.
- Human takeover / emergency stop (TikTok stays connected).
- Batch start-ready / stop-all; realtime app events.
- Vitest + CI; DEMO smoke vs gated REAL smoke checklists.

## What is explicitly not claimed

- Real 3-account TikTok/Gemini smoke PASS
- Real 3-account audio isolation PASS
- Real multi virtual camera PASS
- Avatar realtime FPS target PASS
- Production installer / signing / auto-update

See `docs/MEDIA_REAL_SMOKE_TEST.md` (GATE A–F).

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

Optional MuseTalk local worker (mock by default): see `docs/MUSETALK_LOCAL.md`.

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

This is **not** a production claim. Real TikTok, Gemini, Khepree production lease, installer, multi virtual camera, and avatar FPS are **not** validated as shipping-ready. Reverse-engineered web connectors can break; they stay behind replaceable adapters.

See `docs/PROJECT_STATE.md`, `docs/FEATURE_MATRIX.md`, `docs/MULTI_LIVE_ARCHITECTURE.md`, `docs/VIRTUAL_CAMERA_FEASIBILITY.md`, `docs/REAL_SMOKE_TEST.md`, `docs/MEDIA_REAL_SMOKE_TEST.md`, `docs/REVIEW_NEXT.md`.
