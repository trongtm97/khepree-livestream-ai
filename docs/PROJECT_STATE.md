# Project state — Development milestone 0.3.x

> package.json vẫn `0.1.0`. Đây **không** phải claim production release.

Rà theo **code** sau Prompt 01–09 (session safety, multi-live ops, voice, takeover, smoke harness).

## Milestone 0.3 focus

Multi-live core (0.2) **plus** operator hardening: stale-session guards, approval binding, event dedupe, batch ops, realtime UI events, Windows resource metrics, TTS media sessions, human takeover, gated real-smoke process.

## Implemented (wired in `AppContainer`)

- Secure Electron split + typed preload + account-aware IPC.
- SQLite multi-live schema through **v4** (`media_profiles`).
- `MultiLiveRuntimeManager` / per-account `LiveRuntime` (batch start-ready / stop-all).
- `TikTokConnectorRegistry` + `LiveManagerRegistry` (per-account).
- Comment feed isolation + `LiveEventDeduplicator` (cross-source).
- Approval Engine with **session binding** (stop expires pending; no stale auto-approve).
- Session **epoch / generation** guards + crash recovery (no auto-resume).
- `AiRequestScheduler` fairness + stale discard.
- `MediaSessionFactory` → Windows SAPI TTS + local speaker preview (per-account voice profile).
- `OperatorControlService` — takeover / emergency (does not disconnect TikTok).
- `SystemResourceMonitor` + ResourceGovernor (CPU sampling on Windows; GPU optional NVIDIA).
- `AppEventHub` realtime channel + coalesced snapshot sync.
- Live Center / Account Detail / Voice UI; takeover banner.
- Vitest suite + CI + `test:smoke:demo` / `test:smoke:gate`.
- Operator checklist: `docs/REAL_SMOKE_TEST.md`.

## Deliberately not claimed production-ready

- Real TikTok / LIVE Manager / Gemini **account smoke** (checklist exists; results not committed as PASS).
- Production Khepree lease signing key pin + platform capacity seed.
- Avatar / MuseTalk / virtual camera / virtual audio.
- Windows clean-install installer smoke + code signing + auto-update.
- Script editor / log viewer tabs (Coming Soon).

## How to verify (automated)

```bash
npm ci
npm run typecheck
npm test
npm run test:foundation
npm run test:smoke:gate
npm run test:smoke:demo
```

Manual real accounts:

```bash
KHEPREE_REAL_SMOKE=1 npm run test:smoke:real
```

See `docs/FEATURE_MATRIX.md`, `docs/REVIEW_NEXT.md`.
