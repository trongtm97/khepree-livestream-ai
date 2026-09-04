# Multi-Live Architecture (domain slice)

Status: **usable multi-live core (milestone 0.2.x)** — domain, runtime, registries, account-aware IPC, Live Center UI, capacity gates, Vitest release blockers.

## Goals

- Support many independent TikTok seller accounts in one desktop install.
- One TikTok account → **at most one** active livestream at a time.
- Different accounts may livestream **concurrently** (subject to Khepree license + hardware capacity).
- Keep secrets out of SQLite account rows: **no passwords**, **no raw cookies**.
- `focusedAccountId` is **UX navigation only** — never backend event routing.

## Account model

### `TikTokAccount` (persistent)

| Field | Notes |
|-------|--------|
| `id` | Stable id (`acc_…`) |
| `username` | Normalized `@handle` |
| `displayName` / `label` | Operator-facing names |
| `profileKey` | **Immutable** filesystem key → `browser-profiles/<profileKey>` |
| `enabled` | Soft disable |

### `AccountLiveSettings`

Per-account `automationMode`, `currentProductId`, `mediaProfileId`, `enabled`. Changing A must not mutate B.

## Session model

`LiveSession`: start → `ended_at IS NULL`; crash recovery marks stale rows `CRASH_RECOVERED` (no auto-resume). Schema version via `app_meta.schema.version` (v3 adds `status`).

## Isolation rules

| Entity | Key |
|--------|-----|
| `LiveEvent` | required `accountId` (+ optional `sessionId`) |
| Approvals / comment feed | account-bound; cross-account ops throw |
| TikTok connector | one worker/process/port/token per account |
| LIVE Manager | one observer/profile/diagnostics dir per account |

## Runtime stack

```
AppContainer
├── MultiLiveRuntimeManager → Map<AccountId, LiveRuntime>
├── TikTokConnectorRegistry → Map<AccountId, TikTokConnectorManager>
├── LiveManagerRegistry → Map<AccountId, LiveManagerManager>
├── AiRequestScheduler → wraps LlmProviderManager
├── CommentFeedService → per-account buffers
├── LiveCapacityService → license limits ≠ ResourceGovernor
└── KhepreeAccessService → fail-closed access + feature map
```

### Capacity (PROMPT 07)

Khepree feature keys (client convention; platform seed pending):

- `multi_live_enabled` (boolean)
- `max_tiktok_accounts` (integer)
- `max_concurrent_lives` (integer)

Absent keys → fail-closed (multi off, max 1). Dev mock uses explicit limits. Hardware blockers (`RAM_LOW`, …) are separate typed errors.

## UI

- **Live Center** (`OverviewPage`): metrics, account cards, operator queue, add-account wizard, start-ready / stop-all AI.
- **Account Detail** (`LiveControlPage`): tabs for overview / comments / approvals / products / connections / logs.
- Plain-language Basic UI — no “Runtime / Event Bus / Worker” jargon.

## Deferred / LIVE_SMOKE_PENDING

- Real TikTokLive account smoke + selector pack validation.
- Real Gemini browser login smoke.
- Production Khepree lease signing key pin.
- TTS/avatar media tiers (governor only hints today).
- Windows installer clean-machine smoke.

## Tests

See `tests/` (Vitest) and `docs/FEATURE_MATRIX.md` test map. Legacy `*-self-check.ts` files remain for `npm run test:legacy:*`.
