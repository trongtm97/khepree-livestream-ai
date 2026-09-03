# Connector contracts

## Gemini Web worker

Python dependency:
`pip install -U gemini_webapi[browser]`

Local endpoints:

- `GET /health`
- `POST /v1/init`
- `GET /v1/models`
- `POST /v1/generate`

All calls require `Authorization: Bearer <random-local-worker-token>`.

The main application should never persist the worker token. It is generated at worker start.

## TikTokLive worker

Python dependency:
`pip install TikTokLive`

Endpoints:

- `GET /health`
- `POST /v1/connect`
- `POST /v1/disconnect`
- `GET /v1/events?after=<sequence>&limit=...`

Events are normalized before entering the main Event Bus.

## LIVE Manager browser observer

Playwright uses a dedicated persistent profile. Login/2FA/CAPTCHA are operator-controlled. DOM selectors belong in selector packs, not the Live Orchestrator.
