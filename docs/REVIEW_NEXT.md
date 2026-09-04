# Review next — top 10 after Prompt 01–09

Based on **current code**, not wishful docs. Milestone **0.3.x** is not production-ready.

| # | Priority | Work | Why |
| --- | --- | --- | --- |
| 1 | **P0** | Run REAL SMOKE for 3 accounts and fill local PASS/FAIL (`docs/REAL_SMOKE_TEST.md`) | Automated suite cannot prove TikTok/Gemini/LIVE Manager |
| 2 | **P0** | Khepree production: pin lease signing key + seed `multi_live_enabled` / max accounts / max lives on platform | Fail-closed client is ready; platform entitlements still soft |
| 3 | **P0** | TikTokLive reconnect + concurrent A/B/C comment proof with markers | Worker registry exists; real disconnect/backoff unproven |
| 4 | **P0** | LIVE Manager selector pack v1 validated on real UI + breakage diagnostics | Foundation pack incomplete; risk of guessing selectors |
| 5 | **P0** | Gemini real login → model list → ActionProposal → reconnect/fallback under quota | Path wired; default still often mock until operator connects |
| 6 | **P1** | Virtual audio sink (keep LocalPreview; add stream-oriented output) | TTS speaks locally; livestream ingest needs non-speaker path |
| 7 | **P1** | Operator log viewer tab (replace Coming Soon logs) | AGENTS.md long-running diagnostics; files may exist without UI |
| 8 | **P1** | Dev-only IPC inject comment (`A_TEST_001` style) for smoke without live chatters | Speeds REAL SMOKE; keep gated/non-packaged |
| 9 | **P1** | Market policy packs as data files + load path | Guard exists; packs not first-class operator config |
| 10 | **P2** | Avatar / MuseTalk + virtual camera (after voice+virtual audio stable) | Explicitly out of V1 voice scope; GPU tiers already hinted only |

## Explicitly not next

- Rewriting MultiLiveRuntimeManager / scheduler / approval session binding from scratch.
- Claiming production-ready without REAL SMOKE PASS.
- Shipping edge-tts as default commercial TTS without legal clearance.

## Verify before starting next build

```bash
npm run typecheck
npm test
npm run test:smoke:gate
```
