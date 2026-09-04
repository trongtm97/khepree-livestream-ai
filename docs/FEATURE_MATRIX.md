# Feature matrix — Khepree Livestream AI

Nguồn sự thật: **source code hiện tại** (không phải bản foundation cũ).

- **Development milestone:** `0.2.x` (multi-live core wired)
- **package.json version:** `0.1.0` (chưa bump release production)
- **Ngày rà:** 2026-09-04
- **Gate:** `npm run typecheck` · `npm test` · `npm run test:foundation`

## Status legend

| Status | Nghĩa |
| --- | --- |
| **IMPLEMENTED** | Đã viết, đã nối vào app đang chạy, có kiểm chứng tự động hoặc wiring rõ |
| **PARTIAL** | Có hành vi thật trong app, còn thiếu mảnh quan trọng hoặc chưa smoke thật |
| **FOUNDATION_ONLY** | Có type/class/sidecar/file, wiring mỏng hoặc pack rỗng |
| **NOT_IMPLEMENTED** | Không có code có nghĩa |
| **LIVE_SMOKE_PENDING** | Code đầy đủ ở lớp local/mock, **chưa** test tài khoản/API thật |

---

## Honest live-smoke flags (không fake)

| Area | Status |
| --- | --- |
| TikTok thật (TikTokLive + LIVE Manager selector) | **Chưa test** — worker/registry có stub + unit; selector pack chưa validate trên live thật |
| Gemini Web thật | **Chưa test** — `LlmProviderManager` / worker có; không claim production login |
| Khepree production (PKCE + lease key pin) | **Chưa smoke** — client + fail-closed có; signing key production chưa pin |
| Windows clean install / Squirrel installer | **Chưa test** |
| Selector pack TikTok LIVE Manager | **Chưa validate** — foundation pack còn selectors rỗng/thiếu |

---

## AppContainer wiring (truth)

`src/main/app-container.ts` **đang** gắn:

| Service | Notes |
| --- | --- |
| SQLite + repositories | products, events, approvals, sessions, tiktok_accounts, account_live_settings (schema v3+) |
| `MultiLiveRuntimeManager` | Per-account `LiveRuntime` |
| `TikTokConnectorRegistry` | Per-account worker process |
| `LiveManagerRegistry` | Per-account Playwright observer/profile |
| `LlmProviderManager` + `AiRequestScheduler` | Gemini preferred path + fair queue |
| `CommentFeedService` | Per-account buffers |
| `LiveCapacityService` + `ResourceGovernor` | License ≠ hardware |
| `KhepreeAccessService` + heartbeat | Fail-closed `assertProductAccess` |
| `LiveSessionRecoveryService` | Startup crash recovery (no auto-resume) |
| `MockMediaProvider` | Wired; TTS/avatar chưa |

`focusedAccountId` = **UI navigation only** — không route event backend.

---

## Platform

| Feature | Status | Notes |
| --- | --- | --- |
| Electron shell + preload typed API | IMPLEMENTED | sandbox / contextIsolation |
| Single-instance + `khepreelivestreamai://` | IMPLEMENTED | LIVE_SMOKE_PENDING OAuth |
| IPC account-aware | IMPLEMENTED | start/stop/product/approvals/TikTok/LM require `accountId` |
| SQLite + schema migrations | IMPLEMENTED | `app_meta.schema.version`; sessions `status` v3 |
| Vitest suite + CI | IMPLEMENTED | `npm test`; `.github/workflows/ci.yml` |
| Foundation static check | IMPLEMENTED | `npm run test:foundation` |

## Licensing (Khepree)

| Feature | Status | Notes |
| --- | --- | --- |
| Catalog identity + access key | IMPLEMENTED | `livestream_ai.access` |
| Capacity keys (convention) | PARTIAL | Client: `multi_live_enabled`, `max_tiktok_accounts`, `max_concurrent_lives` — **platform chưa seed**; fail-closed defaults |
| PKCE / lease / heartbeat | PARTIAL | LIVE_SMOKE_PENDING |
| Dev mock limits | IMPLEMENTED | Explicit 5 lives / 10 accounts |
| Enforce startLive + createAccount caps | IMPLEMENTED | Typed license vs hardware errors |

## Multi-live core

| Feature | Status | Notes |
| --- | --- | --- |
| TikTokAccount + profileKey | IMPLEMENTED | Immutable `tt_<hex>` |
| Per-account LiveRuntime | IMPLEMENTED | Isolated bus/orchestrator/approvals |
| Concurrent lives + stop one / stop all | IMPLEMENTED | Tested |
| Cross-account event isolation | IMPLEMENTED | 100×3 flood test |
| Per-account product selection | IMPLEMENTED | A→Z leaves B on Y |
| Comment feed multi-account | IMPLEMENTED | Per-account cap 300 |
| Approval cross-account reject | IMPLEMENTED | `APPROVAL_ACCOUNT_MISMATCH` |
| TikTok connector registry | IMPLEMENTED | Stub workers in tests; LIVE_SMOKE_PENDING thật |
| LIVE Manager registry | IMPLEMENTED | Stub observers in tests; LIVE_SMOKE_PENDING thật |
| Session crash recovery | IMPLEMENTED | `CRASH_RECOVERED`; no auto-resume |
| AI request scheduler | IMPLEMENTED | Fairness + stale cancel |
| ResourceGovernor | PARTIAL | RAM/CPU counts; GPU UNKNOWN; no auto-stop |
| Live Center UI | IMPLEMENTED | Metrics, cards, queue, wizard, run/stop ready |
| Account detail tabs | PARTIAL | Basic sections; not full analytics |

## AI / LLM

| Feature | Status | Notes |
| --- | --- | --- |
| Mock LLM | IMPLEMENTED | Dev |
| Gemini worker + provider manager | PARTIAL | LIVE_SMOKE_PENDING |
| Sales brain structured parse | PARTIAL | Schema + hallucination guards |
| Fallback script brain | PARTIAL | Phase FALLBACK_SCRIPT wired |
| Avatar / TTS / virtual camera | NOT_IMPLEMENTED | Media mock only |

## TikTok

| Feature | Status | Notes |
| --- | --- | --- |
| TikTokLive Python worker | PARTIAL | LIVE_SMOKE_PENDING |
| Connect/disconnect IPC + UI | PARTIAL | Per focused account panels |
| Comment ingest → bus → feed | PARTIAL | Path wired; LIVE_SMOKE_PENDING |
| LIVE Manager Playwright | PARTIAL | Registry wired; selectors LIVE_SMOKE_PENDING |
| Order / violation scan | FOUNDATION_ONLY | Selector packs incomplete |
| Viewer count / revenue UI | NOT_IMPLEMENTED | Intentionally no fake numbers |

## Product

| Feature | Status | Notes |
| --- | --- | --- |
| Product DNA schema + CRUD IPC | PARTIAL | Richer form than early foundation |
| Import helpers | PARTIAL | CSV/paste helpers; LIVE_SMOKE_PENDING UX depth |
| Per-account current product | IMPLEMENTED | |

## UX

| Feature | Status | Notes |
| --- | --- | --- |
| VI/EN i18n | IMPLEMENTED | No hardcoded bilingual in components |
| Onboarding + Help | IMPLEMENTED | |
| Error dialog + toast | IMPLEMENTED | |
| Readiness checklist | IMPLEMENTED | Still useful; Live Center is primary overview |
| Live Center + Account Detail | IMPLEMENTED | |

## Commercial / reliability

| Feature | Status | Notes |
| --- | --- | --- |
| Crash session recovery | IMPLEMENTED | DB stale sessions |
| App dispose (runtimes/scheduler/workers) | PARTIAL | `AppContainer.dispose` wired; full orphan process assert limited in CI |
| Installer / code signing / auto-update | NOT_IMPLEMENTED / FOUNDATION_ONLY | Squirrel config exists |
| Production release claim | NOT_IMPLEMENTED | Milestone 0.2.x only |

---

## Test map (release blockers)

| Blocker | Covered by |
| --- | --- |
| 100 events A/B/C zero cross-contamination | `tests/multi-live/cross-account-events.test.ts` |
| Comment A ∉ feed B | `tests/comments/feed-isolation.test.ts` |
| Approval A not resolve via B | `tests/approval/cross-account.test.ts` |
| Product A/X B/Y → A→Z B stays Y | `tests/multi-live/runtime-isolation.test.ts` + DB self-check |
| TikTok workers independent | `tests/tiktok/connector-isolation.test.ts` (stub) |
| LIVE Manager observers independent | same (stub) |
| Crash session recovery | `tests/session-recovery/crash.test.ts` |
| AI scheduler fairness + stale | `tests/llm-scheduler/fairness.test.ts` |
| Stop B → A/C continue; stopAll | `tests/multi-live/stop-lifecycle.test.ts` |
| Dispose | `tests/multi-live/dispose-capacity.test.ts` |

Self-check scripts under `src/**/**self-check.ts` **vẫn giữ** cho `test:legacy:*` và foundation-era assert helpers.
