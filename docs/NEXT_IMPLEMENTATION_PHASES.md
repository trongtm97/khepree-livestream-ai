# Next implementation phases

Ordered for remaining production risk. Multi-live **core** is already in milestone 0.2.x — do not rebuild it.

## P0 (release blockers for real selling)

1. **Khepree live acceptance**
   - Register livestream product + seed `multi_live_enabled` / `max_tiktok_accounts` / `max_concurrent_lives` on platform
   - Pin production lease signing key
   - PKCE + activate + heartbeat smoke

2. **TikTok live smoke**
   - Real TikTokLive connect on one account, then two concurrent accounts
   - Prove comment → bus → feed with real events
   - Reconnect / backoff under disconnect

3. **LIVE Manager selector pack v1**
   - Validate against real LIVE Manager UI
   - Diagnostics on selector breakage
   - Order/violation rows only after selectors exist (no fake data)

4. **Gemini live smoke**
   - Real browser session / model list / generate → ActionProposal
   - Circuit breaker + fallback under quota

5. **Windows package smoke**
   - Clean machine install
   - SafeStorage / DPAPI
   - No orphan workers after quit

## P1 (product depth)

6. Product DNA importer + richer editor (facts/claims/FAQ UX)
7. TTS + virtual audio (assistant-without-avatar tier first)
8. Policy packs by market (load JSON, not only hardcoded guard)
9. Operator log viewer under `%APPDATA%\...\logs\`
10. Approval edit-speech UX polish + supervised countdown clarity

## P2 (later)

11. Avatar / LiveTalking / MuseTalk + GPU media tiers
12. Auto-update + signed connector/selector packs
13. Telemetry opt-in
14. Code signing

## Already done (do not re-open as greenfield)

- Per-account LiveRuntime / TikTok registry / LIVE Manager registry
- Comment feed multi-live + approval account mismatch
- Crash session recovery
- AI request scheduler fairness
- License vs hardware capacity service
- Live Center UI + Vitest CI
