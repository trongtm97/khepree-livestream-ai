# Khepree Livestream AI

Foundation repository for a Windows desktop application that helps one human operator run a TikTok commerce livestream with AI assistance.

**Product philosophy:** human-supervised autonomy. AI handles repetitive work; the operator can approve, edit, cancel, or take over at any time.

## What is implemented in this foundation

- Secure Electron process boundary.
- React operator dashboard.
- Local SQLite schema for products, sessions, events, approval queue, and settings.
- Provider interfaces for LLM, TikTok events, media/avatar output, and browser automation.
- Gemini Web sidecar contract using `gemini_webapi` (HanaokaYuzu/Gemini-API) without copying that AGPL project into this proprietary repository.
- TikTokLive sidecar contract for unofficial realtime comments/events, again isolated as a separate process.
- TikTok LIVE Manager Playwright observer scaffold.
- Livestream Event Bus, Sales State Machine, comment priority scorer, Approval Engine, and Live Orchestrator.
- Offline text-to-speech output (OS speech engine) with a speech queue and an operator voice kill-switch.
- Emergency stop that silences audio and drops to manual mode without ending the livestream.
- Livestream history — reviews recorded sessions, comments, orders, and what the AI said.
- Khepree commercial licensing foundation modeled after Khepree Novel AI: PKCE, device Ed25519 identity, encrypted refresh token, signed lease verification, heartbeat state, and fail-closed protected actions.
- Dev-mock adapters so later AI coding agents can extend the system without destroying the architecture.

## First run

```bash
npm install
copy .env.example .env
npm run doctor
npm run test:foundation
npm test
npm start
```

`npm test` runs the Vitest suite over the approval engine, live orchestrator,
event bus, media manager, and session history SQL.

### Voice output

The AI's drafted lines are spoken using the computer's own speech engine
(Windows SAPI, macOS `say`, or Linux `espeak-ng`) — no API key, no per-character
billing, and nothing leaves the machine. If no engine is available the app says
so in **Settings → AI voice** instead of pretending to speak.


For Gemini worker dependencies:

```bash
python -m venv worker-env
worker-env\Scripts\pip install -r workers/gemini_worker/requirements.txt
worker-env\Scripts\pip install -r workers/tiktok_worker/requirements.txt
```

Then log in to Gemini in Firefox or provide the two Gemini cookies through a future encrypted settings UI. The worker itself never asks for a Google password.

## Data location

All persistent user data is intended to live under:

`%APPDATA%\KhepreeLivestreamAI\`

- `data/app.sqlite`
- `secrets/`
- `browser-profiles/`
- `logs/`
- `diagnostics/`

## Important

This is a **foundation build**, not a production claim. Reverse-engineered web connectors can break when upstream websites change. They are intentionally isolated behind replaceable adapters.

See `docs/PROJECT_STATE.md` and `docs/NEXT_IMPLEMENTATION_PHASES.md`.
