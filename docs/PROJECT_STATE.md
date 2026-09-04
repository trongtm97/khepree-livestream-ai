# Project state — Development milestone 0.2.x

> package.json vẫn `0.1.0`. Đây **không** phải claim production release.

## Milestone 0.2 focus

Multi-live domain + runtime + connectors + Live Center UI + license/hardware capacity + Vitest CI.

## Implemented (wired in `AppContainer`)

- Secure Electron process split + typed preload.
- SQLite multi-live schema (accounts, per-account settings, sessions with crash status).
- `MultiLiveRuntimeManager` / per-account `LiveRuntime`.
- `TikTokConnectorRegistry` + `LiveManagerRegistry`.
- Comment feed with required `accountId` + per-account buffers.
- Approval Engine + cross-account resolve protection.
- `AiRequestScheduler` over `LlmProviderManager`.
- `LiveCapacityService` (Khepree license limits ≠ `ResourceGovernor` hardware).
- Live session crash recovery on startup (no auto-resume).
- Live Center UI + Account Detail tabs (VI/EN i18n).
- Operator feedback: error dialog, toasts, readiness checklist, help.
- Vitest suite (`npm test`) + GitHub Actions CI + foundation static check.

## Deliberately not claimed production-ready

- Live Khepree registration + pinned production lease signing key.
- Gemini real-account onboarding smoke.
- TikTokLive / LIVE Manager against a **real** seller account.
- Selector pack validation on live TikTok UI.
- TTS / avatar / virtual camera.
- Windows clean-install installer smoke + code signing.
- Auto-update / telemetry.

## How to verify

```bash
npm ci
npm run typecheck
npm test
npm run test:foundation
```

See `docs/FEATURE_MATRIX.md` for per-module status.
