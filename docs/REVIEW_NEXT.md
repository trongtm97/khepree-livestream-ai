# Review next — top 10 after Prompt 01–12 (milestone 0.4.x)

Based on **current code**, not wishful docs. Milestone **0.4.x** = media routing + avatar **foundation**. **Not production-ready.** package.json stays `0.1.0` until real smoke PASSes.

Media gates: `docs/MEDIA_REAL_SMOKE_TEST.md` (A–F). Core TikTok/Gemini checklist: `docs/REAL_SMOKE_TEST.md`.

| # | Priority | Work | Why |
| --- | --- | --- | --- |
| 1 | **P0** | Run GATE A — 3-account TikTok/Gemini REAL SMOKE; record local PASS/FAIL | Automated suite cannot prove live connectors |
| 2 | **P0** | Run GATE B — 3-account audio endpoint isolation (no bleed) | Routing code exists; real Windows isolation unproven |
| 3 | **P0** | Khepree production: pin lease signing key + seed multi-live capacity features | Fail-closed client ready; platform entitlements soft |
| 4 | **P0** | LIVE Manager selector pack v1 on real UI + breakage diagnostics | Foundation pack incomplete |
| 5 | **P1** | UnityCapture bridge spike → GATE C (2-cam RED/BLUE isolation) | Feasibility written; WindowsVirtualCameraOutput still stub |
| 6 | **P1** | Avatar FPS bench → GATE D; keep GpuMediaScheduler Voice Only degrade | MuseTalk worker mock-first; realtime not proven |
| 7 | **P1** | GATE E — takeover stops only target account’s TTS/avatar | Operator control tested in Vitest; media path needs real proof |
| 8 | **P1** | GATE F — crash recovery with audio bridge / avatar worker processes | Session recovery exists; media orphan cleanup unproven |
| 9 | **P1** | Operator log viewer tab (replace Coming Soon) | Long-running diagnostics for operators |
| 10 | **P2** | Signed multi virtual-cam installer + “Camera Khepree N” naming | After GATE C PASS only |

## Explicitly not next

- Rewriting MultiLiveRuntimeManager / AiRequestScheduler / approval session binding from scratch.
- Claiming multi virtual camera or avatar livestream “works” without GATE C/D PASS.
- Bumping package.json to a production release version without GATE A–F.
- Shipping GPL OBS plugins inside proprietary core (keep external optional).
- Shipping edge-tts as default commercial TTS without legal clearance.

## Verify before starting next build

```bash
npm run typecheck
npm test
npm run test:smoke:gate
```
