# Next implementation phases

Ordered for remaining **production risk**. Multi-live core + voice/takeover hardening are in milestone **0.3.x** — do not rebuild them as greenfield.

## P0 (release blockers for real selling)

1. **Execute REAL SMOKE (3 accounts)** — `docs/REAL_SMOKE_TEST.md`; record local PASS/FAIL only.
2. **Khepree live acceptance** — platform seed capacity keys; pin production lease signing key; PKCE smoke.
3. **TikTokLive concurrent smoke** — A/B/C connect; markers `A_TEST_001`…; reconnect/backoff.
4. **LIVE Manager selector pack v1** — validate on real UI; diagnostics when selectors break.
5. **Gemini live smoke** — real login, model list, generate → ActionProposal, reconnect + fallback under quota.
6. **Windows package smoke** — clean install; SafeStorage; no orphan workers after quit.

## P1 (product depth)

7. Virtual audio output (stream path) — keep TTS; add non-speaker sink after LocalPreview.
8. Policy packs by market (JSON packs, not only hardcoded guard).
9. Operator log viewer (`%APPDATA%\...\logs\`) + replace Coming Soon logs tab.
10. Product DNA importer UX + richer facts/claims/FAQ editor.
11. Dev IPC inject comment (safe markers) to speed REAL SMOKE without live chatters.
12. Approval edit-speech UX polish + supervised countdown clarity.

## P2 (later)

13. Avatar / LiveTalking / MuseTalk + GPU media tiers (governor already hints).
14. Virtual camera.
15. Auto-update + signed connector/selector packs.
16. Telemetry opt-in + code signing.

## Already done (do not re-open as greenfield)

- Per-account LiveRuntime / TikTok / LIVE Manager registries
- Session epoch + approval session expire + crash recovery
- Cross-source event dedupe
- Batch start/stop in main
- App event channel
- SystemResourceMonitor + governor wiring
- MediaSession + Windows SAPI TTS + Voice UI
- Human takeover / emergency stop
- REAL vs DEMO smoke gate

Detail queue: `docs/REVIEW_NEXT.md`.
