# Multi-Live Architecture (domain slice)

Status: **usable multi-live core + operator hardening (milestone 0.3.x)** — domain, runtime, registries, account-aware IPC, Live Center, capacity, voice sessions, takeover, Vitest blockers. **Not** a production claim.

## Goals

- Many independent TikTok seller accounts in one desktop install.
- One TikTok account → **at most one** active livestream AI at a time.
- Different accounts may run **concurrently** (Khepree license + hardware capacity).
- Secrets out of SQLite account rows: **no passwords**, **no raw cookies**.
- `focusedAccountId` is **UX navigation only** — never backend event routing.
- Human always wins: takeover / emergency mute AI without killing TikTok/browser.

## Account model

### `TikTokAccount` (persistent)

| Field | Notes |
|-------|--------|
| `id` | Stable id (`acc_…`) |
| `username` | Normalized `@handle` |
| `displayName` / `label` | Operator-facing names |
| `profileKey` | **Immutable** → `browser-profiles/<profileKey>` |
| `enabled` | Soft disable |

### `AccountLiveSettings`

Per-account `automationMode`, `currentProductId`, `mediaProfileId`, `enabled`.

### `media_profiles` (schema v4)

Per-account TTS provider/voice/rate. Bound via `mediaProfileId`.

## Session model

`LiveSession`: start → `ended_at IS NULL`; crash recovery marks stale rows `CRASH_RECOVERED` (no auto-resume).

Orchestrator **run generation** + approval **sessionId** binding: stop/new session cannot apply stale LLM / auto-approve.

Schema: `app_meta.schema.version` — **current = 4**.

## Isolation rules

| Entity | Key |
|--------|-----|
| `LiveEvent` | required `accountId` (+ optional `sessionId`) |
| Approvals / comment feed | account-bound; cross-account ops throw |
| Event dedupe | per-account+session; exact id + semantic fingerprint across sources |
| TikTok connector | one worker/process/port/token per account |
| LIVE Manager | one observer/profile/diagnostics dir per account |
| MediaSession | one speech queue per account; stop A ≠ stop B |
| Operator control | takeover/emergency per account (or global emergency latch) |

## Runtime stack

```
AppContainer
├── MultiLiveRuntimeManager → Map<AccountId, LiveRuntime>
│     ├── startReadyLives / stopAll (batch)
│     └── operatorControl (takeover / emergency)
├── TikTokConnectorRegistry → Map<AccountId, TikTokConnectorManager>
├── LiveManagerRegistry → Map<AccountId, LiveManagerManager>
├── AiRequestScheduler → wraps LlmProviderManager
├── MediaSessionFactory → VoiceMediaSession (TTS + LocalPreview)
├── CommentFeedService → per-account buffers
├── AppEventHub → APP_EVENT to renderer
├── LiveCapacityService → license ≠ ResourceGovernor + SystemResourceMonitor
└── KhepreeAccessService → fail-closed access + feature map
```

### Capacity

Khepree feature keys (client convention; platform seed pending):

- `multi_live_enabled`
- `max_tiktok_accounts`
- `max_concurrent_lives`

Absent keys → fail-closed. Hardware blockers (`RAM_LOW`, `CPU_HIGH`, …) separate; CPU **UNKNOWN** does not block start.

### Media (voice-only)

- `TtsProvider` pluggable (default Windows SAPI on win32).
- `AudioOutput`: `LocalPreviewOutput` only — **no** virtual audio / camera / avatar yet.
- edge-tts not registered (commercial ToS unclear).

## UI

- **Live Center:** metrics (incl. machine resources), cards, operator queue, batch start/stop, emergency stop.
- **Account Detail:** takeover / release / F8; banner when human controls.
- **Voice tab:** voices, rate, preview, engine status.
- Script / Logs tabs still Coming Soon.

## Deferred / REAL_SMOKE_PENDING

- Real TikTokLive + LIVE Manager selector validation.
- Real Gemini browser login smoke.
- Production Khepree lease signing key pin.
- Virtual audio / avatar / MuseTalk / virtual camera.
- Windows installer clean-machine smoke.

## Tests & smoke

- Automated: `tests/` + `npm run test:smoke:demo`.
- Manual 3-account: `docs/REAL_SMOKE_TEST.md` (gated by `KHEPREE_REAL_SMOKE=1`).
- Legacy `*-self-check.ts` remain for `npm run test:legacy:*`.
