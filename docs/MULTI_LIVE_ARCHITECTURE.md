# Multi-Live Architecture (domain slice)

Status: **usable multi-live foundation** — domain, runtime, manager, account-aware IPC, account switcher UI, LIVE Manager `profileKey` binding. Still deferred: multi TikTok worker processes and multi-pane concurrent live UI.

## Goals

- Support many independent TikTok seller accounts in one desktop install.
- One TikTok account may have **at most one active livestream** at a time.
- Different TikTok accounts may livestream **concurrently** (future runtime; not wired yet).
- Keep secrets out of SQLite account rows: **no passwords**, **no raw cookies**.

## Account model

### `TikTokAccount` (persistent)

A seller identity that exists whether or not a livestream is running.

| Field | Notes |
|-------|--------|
| `id` | Stable id (`acc_…`) |
| `username` | Normalized `@handle` |
| `displayName` / `label` | Optional operator-facing names |
| `profileKey` | **Immutable**, filesystem-safe key for `browser-profiles/<profileKey>` |
| `enabled` | Soft disable without deleting history |
| `createdAt` / `updatedAt` / `lastConnectedAt` | Timestamps |

`profileKey` must never be derived from an unsanitized username. Usernames change and may contain path-unsafe characters. Generate a UUID-based key (e.g. `tt_<hex>`) and keep it immutable for the life of the account.

### `AccountLiveSettings` (per account)

Isolated live configuration for one account:

| Field | Notes |
|-------|--------|
| `accountId` | PK / FK → `tiktok_accounts.id` |
| `automationMode` | Default `SUPERVISED_AUTO` |
| `currentProductId` | Optional Product DNA id for this account only |
| `mediaProfileId` | Optional; future media binding |
| `enabled` | Settings-level enable flag |
| `updatedAt` | |

Changing product/mode on account A **must not** mutate account B. Current product for live is owned by `AccountLiveSettings` / `LiveRuntime` — not a global `AppContainer.currentProductId`. Legacy `app_meta` `products.currentId` may be migrated into the primary account once, then ignored as source of truth.

## Session model

### `LiveSession`

Each **Start Live** creates a new session row.

| Field | Notes |
|-------|--------|
| `id` | UUID |
| `accountId` | Which `TikTokAccount` owns this run |
| `startedAt` / `endedAt` | Active session ⇒ `ended_at IS NULL` |
| `automationMode` | Mode at session start |
| `finalState` | Sales state when stopped |

Rules:

1. One account → many historical sessions.
2. One account → **at most one** active session (`ended_at IS NULL`).
3. Deleting a `TikTokAccount` **must refuse** while that account has an active session.

## Data isolation

Provenance on every live signal:

| Entity | Isolation keys |
|--------|----------------|
| `LiveEvent` | **`accountId` (required)** + optional `sessionId` |
| `ApprovalItem` | keep `sessionId`; optional `accountId` for fast query |
| `live_events` / `approvals` rows | mirrored `account_id` columns for SQL diagnostics |

Events from account A must never be attributable to account B. Until connectors bind a real account, emitters may stamp `acc_unassigned` (`UNASSIGNED_ACCOUNT_ID`); later tasks replace that with the owning account id at the connector boundary.

**Do not** introduce a global `currentTikTokUsername` as the source of truth. Prefer account id + repositories.

**Do not** store the whole multi-account state as one giant JSON blob when normalized tables exist.

## Database schema

Versioned via `app_meta.schema.version` (additive migrations only; never drop the database).

### v1 — foundation (existing)

`app_meta`, `products`, `live_sessions`, `live_events`, `approvals`, `secrets`

### v2 — multi-live accounts

```sql
tiktok_accounts (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  display_name TEXT,
  label TEXT,
  profile_key TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_connected_at TEXT
);
-- index: username

account_live_settings (
  account_id TEXT PRIMARY KEY,
  automation_mode TEXT NOT NULL,
  current_product_id TEXT,
  media_profile_id TEXT,
  enabled INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (account_id) REFERENCES tiktok_accounts(id)
);

-- Additive columns (ALTER, no DROP):
live_sessions.account_id
live_events.account_id
approvals.account_id

-- Indexes:
live_events(account_id, timestamp)
live_events(session_id, sequence)
live_sessions(account_id, ended_at)
approvals(account_id)
```

Repositories:

- `TikTokAccountRepository` — `list`, `get`, `findByUsername`, `create`, `update`, `delete` (delete refuses if LIVE)
- `AccountLiveSettingsRepository` — `get`, `ensure`, `upsert`

## Stream runtime (PROMPT MULTI-LIVE 02)

### `LiveRuntime`

One isolated runtime per `TikTokAccount`. **Not** a shared singleton orchestrator with `if (event.accountId !== …) return`.

Owns:

| Concern | Isolation |
|---------|-----------|
| `accountId` | Fixed at construction |
| `LiveEventBus` | Private instance |
| `LiveOrchestrator` | Private instance (owns `LiveMemory` + `ApprovalEngine`) |
| `currentProductId` | From `AccountLiveSettings` / runtime — **not** `AppContainer` global |
| `automationMode` | Per account settings + orchestrator |
| `sessionId` | Active live session |
| Runtime health | `health()` |

Shared (injected):

- SQLite connection / repositories
- `ProductRepository` (catalog)
- LLM base provider (`LlmProviderManager` / Gemini)
- `KhepreeAccessService`

Deferred per-runtime (later prompts): TikTok connector, LIVE Manager observer, dedicated media session.

### Event ingress

`LiveRuntime.publishEvent(event)` is the only external ingress:

1. Reject if `event.accountId !== runtime.accountId` (`EVENT_ACCOUNT_MISMATCH`).
2. If live and connector omitted `sessionId`, stamp the active session id.
3. Persist `live_events` with `account_id` + `session_id`.
4. Publish onto **this** runtime's bus (orchestrator + comment feed subscribers).

### Approvals

While live, approvals are persisted with both `accountId` and `sessionId` — never `session_id = null` for an active session.

### AppContainer

Holds shared services only:

- SQLite / repositories
- Khepree + heartbeat
- Global LLM provider
- `MultiLiveRuntimeManager`
- Fan-in UI event bus + CommentFeed
- Legacy **single** TikTokLive worker + LIVE Manager manager (routed by focused account; LIVE Manager browser profile uses `account.profileKey`)

Does **not** hold:

- `readonly live: LiveOrchestrator` / single global orchestrator
- Global `currentProductId`

Operator UX:

- Connections page: create / focus / edit username / delete TikTok accounts
- Header: focused-account selector
- Focused account id persisted in `app_meta` (`ui.focusedAccountId`)
- `openLiveManager(accountId)` opens Playwright profile at `browser-profiles/<profileKey>`

## Explicitly not done yet

- Multiple TikTok Python worker processes (one worker per account concurrently)
- Dedicated per-account media/TTS sessions beyond MockMedia factory
- Full multi-pane live dashboard (one screen per concurrent stream)

## MultiLiveRuntimeManager (PROMPT MULTI-LIVE 03)

Registry: `Map<accountId, LiveRuntime>` (O(1) lookup — never linear-scan runtimes to route events).

| Method | Role |
|--------|------|
| `listAccounts` / `listRuntimes` / `getRuntime` / `ensureRuntime` | Registry |
| `startLive(accountId)` | Entitlement + concurrency + readiness, then `runtime.start()` |
| `stopLive(accountId)` | Stop **only** that runtime |
| `stopAll()` | Quit / emergency — does not tear down Gemini, DB, Khepree |
| `disposeAccount` | Stop + dispose runtime, remove from map |
| `setCurrentProduct` / `setAutomationMode` / `resolveApproval` | Per-account |
| `getSnapshot` / `getAllSnapshots` | `AccountLiveSnapshot` |

### `startLive` order

1. Account exists  
2. Account enabled  
3. Not already active  
4. Khepree entitlement (`assertProductAccess`)  
5. Concurrency limit (`DEFAULT_MAX_CONCURRENT_LIVES` / override)  
6. `ensureRuntime`  
7. Settings enabled + optional readiness hook  
8. `runtime.start()`

### IPC compatibility

- Every protected live action requires explicit `accountId` (validated in main via `requireValidAccountId` — never trust the renderer).
- Channels: `startLive(accountId)`, `stopLive(accountId)`, `setAutomationMode(accountId, mode)`, `resolveApproval(accountId, approvalId, …)`, `connectTikTok(accountId)`, `disconnectTikTok(accountId)`, `openLiveManager(accountId)`, `setCurrentProduct(accountId, productId)`, `getAccountSnapshot(accountId)`, `getMultiLiveSnapshot()`.
- Cross-account approval resolve → `APPROVAL_ACCOUNT_MISMATCH`.
- Preload stays `contextIsolation` + typed `RendererApi` only — no runtimes, cookies, BrowserContext, or child processes.
- `AppSnapshot.lives` / `MultiLiveSnapshot` are the multi-live source of truth; legacy single-pane fields mirror the focused account when present.
- Dev may set a focused account for UI convenience; IPC handlers still require `accountId` on each call.

### `AccountLiveSnapshot`

`accountId`, `username`, `label`, `isRunning`, `sessionId`, `state`, `automationMode`, `currentProductId`, `pendingApprovalCount`, `health`.

## Explicitly not in this slice

- Multiple TikTok Python workers (concurrent process-per-account)
- Full multi-pane concurrent live operator UI
- Cookie/password storage in SQLite
