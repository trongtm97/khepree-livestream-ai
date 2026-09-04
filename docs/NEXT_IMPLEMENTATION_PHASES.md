# Next implementation phases

Ordered for remaining **production risk**. Milestone **0.4.x** = media routing + avatar **foundation** (not shipping-ready media). Do not rebuild 0.3 multi-live core as greenfield.

## Release gates (must PASS before production claim)

Defined in `docs/MEDIA_REAL_SMOKE_TEST.md`:

| Gate | Proof |
| --- | --- |
| **A** | 3-account TikTok/Gemini REAL SMOKE |
| **B** | 3-account audio routing isolation |
| **C** | 2-account virtual camera isolation |
| **D** | Avatar realtime ≥ target FPS |
| **E** | Human takeover stops only target account (incl. media) |
| **F** | Crash recovery with media processes |

Until A–F PASS locally (results gitignored), keep package at `0.1.0` and milestone label **0.4.x development**.

## P0 (release blockers)

1. **Execute MEDIA + core REAL SMOKE** — fill local PASS/FAIL for GATE A–F; never commit secrets.
2. **Khepree live acceptance** — platform seed capacity keys; pin production lease signing key.
3. **TikTokLive concurrent smoke** — A/B/C markers; reconnect/backoff (GATE A).
4. **Audio isolation smoke** — three distinct endpoints; no bleed (GATE B).
5. **LIVE Manager selector pack v1** — real UI + breakage diagnostics.
6. **Gemini live smoke** — login → ActionProposal → fallback under quota (GATE A).
7. **Windows package smoke** — clean install; SafeStorage; no orphan workers after quit (overlaps GATE F).

## P1 (close 0.4 media gaps)

8. **UnityCapture / bridge spike** — prove non-Unity SharedImageMemory sender; then GATE C.
9. **MuseTalk (or chosen engine) FPS bench** — ≥ target at 720×1280 / 1080×1920 (GATE D); fail closed to Voice Only via GpuMediaScheduler.
10. **Takeover + media stop proof** — only target account silences avatar/TTS (GATE E).
11. Operator log viewer tab (replace Coming Soon logs).
12. Policy packs by market (JSON packs).
13. Dev IPC inject comment for smoke without live chatters.
14. Product DNA importer UX + richer claims/FAQ editor.

## P2 (later)

15. Signed virtual-camera installer / device naming (“Camera Khepree N”).
16. Auto-update + signed connector/selector packs.
17. Telemetry opt-in + code signing.
18. Edge-TTS / commercial TTS only after legal clearance.

## Already done (do not re-open as greenfield)

- Per-account LiveRuntime / TikTok / LIVE Manager registries
- Session epoch + approval session expire + crash recovery (session rows)
- Cross-source event dedupe, batch start/stop, app event channel
- SystemResourceMonitor + ResourceGovernor
- Live output modes + MediaSession + Windows SAPI + endpoint routing **code**
- AvatarProvider + LiveTalking/MuseTalk adapters + avatar library
- SceneEngine local preview + VideoOutputProvider **mock** path
- GpuMediaScheduler + Media Readiness Center
- REAL vs DEMO smoke gate scripts

Detail queue: `docs/REVIEW_NEXT.md`.
