# Feature matrix — Khepree Livestream AI

Nguồn sự thật: **source code hiện tại** (rà lại sau Prompt 01–09, 2026-09-04).

- **Development milestone:** `0.3.x` (multi-live + hardening + voice pipeline)
- **package.json version:** `0.1.0` (chưa bump release production)
- **Gate:** `npm run typecheck` · `npm test` · `npm run test:foundation` · `npm run test:smoke:gate`

## Status legend

| Status | Nghĩa |
| --- | --- |
| **IMPLEMENTED** | Đã viết, đã nối vào app, có Vitest/wiring rõ |
| **PARTIAL** | Có hành vi thật trong app, còn thiếu mảnh quan trọng |
| **FOUNDATION_ONLY** | Có type/class/sidecar/file, wiring mỏng hoặc pack rỗng |
| **REAL_SMOKE_PENDING** | Code local/mock đủ dùng, **chưa** PASS trên tài khoản/API thật |
| **NOT_IMPLEMENTED** | Không có code có nghĩa |

---

## Honest real-smoke flags

| Area | Status |
| --- | --- |
| TikTokLive thật (3 account concurrent) | **REAL_SMOKE_PENDING** — checklist: `docs/REAL_SMOKE_TEST.md` |
| LIVE Manager selector pack trên UI thật | **REAL_SMOKE_PENDING** — foundation pack còn selectors mỏng |
| Gemini Web login / generate thật | **REAL_SMOKE_PENDING** |
| Khepree production lease key pin | **REAL_SMOKE_PENDING** |
| Windows clean install / Squirrel | **NOT_IMPLEMENTED** / FOUNDATION_ONLY config |

Operator: `npm run test:smoke:demo` (CI) vs `KHEPREE_REAL_SMOKE=1 npm run test:smoke:real` (manual).

---

## Must-record areas (Prompt 10)

| Feature | Status | Evidence |
| --- | --- | --- |
| Multi-account runtime | **IMPLEMENTED** | `MultiLiveRuntimeManager` → `Map<accountId, LiveRuntime>`; `tests/multi-live/*` |
| TikTok per-account worker | **REAL_SMOKE_PENDING** | `TikTokConnectorRegistry` + `workers/tiktok_worker`; stub Vitest only |
| LIVE Manager per-account | **REAL_SMOKE_PENDING** | `LiveManagerRegistry` + Playwright profiles; stub Vitest only |
| AI scheduler | **IMPLEMENTED** | `AiRequestScheduler`; `tests/llm-scheduler/fairness.test.ts` |
| Session lifecycle / epoch / crash recovery | **IMPLEMENTED** | Orchestrator generation + `LiveSessionRecoveryService`; session-epoch + session-recovery tests |
| Approval session isolation | **IMPLEMENTED** | `ApprovalEngine` requires `sessionId`; expire on stop; `tests/approval/session-binding.test.ts` |
| Cross-source event dedupe | **IMPLEMENTED** | `LiveEventDeduplicator` in `LiveRuntime.publishEvent`; `tests/events/cross-source-dedupe.test.ts` |
| TTS | **IMPLEMENTED** | Windows SAPI `WindowsSapiTtsProvider` → WAV; REAL_SMOKE_PENDING on operator machines without SAPI voices |
| Media session | **IMPLEMENTED** | `MediaSession` / `VoiceMediaSession` / `MediaSessionFactory.create(accountId)`; schema `media_profiles` v4 |
| Human takeover | **IMPLEMENTED** | `OperatorControlService` + F8/app-local; `tests/operator/takeover.test.ts` |
| Resource monitoring | **IMPLEMENTED** | `SystemResourceMonitor` (CPU delta + RAM + optional nvidia-smi); ResourceGovernor uses cache |
| Avatar | **NOT_IMPLEMENTED** | `isAvatarReady()` always false; no MuseTalk |
| Virtual camera | **NOT_IMPLEMENTED** | Readiness stub false |
| Virtual audio | **NOT_IMPLEMENTED** | `LocalPreviewOutput` speakers only; VirtualAudioOutput deferred |

---

## AppContainer wiring (truth)

`src/main/app-container.ts` gắn:

| Service | Notes |
| --- | --- |
| SQLite + repositories | accounts, settings, sessions, events, approvals, products, **media_profiles (v4)** |
| `MultiLiveRuntimeManager` | Per-account `LiveRuntime` + batch start/stop |
| `TikTokConnectorRegistry` / `LiveManagerRegistry` | Per-account |
| `LlmProviderManager` + `AiRequestScheduler` | Fair queue + stale discard |
| `MediaSessionFactory` | Voice TTS per account (not Mock in production path) |
| `OperatorControlService` | Takeover / emergency |
| `CommentFeedService` + `AppEventHub` | Scoped snapshots + realtime events |
| `LiveCapacityService` + `OsResourceGovernor` + `SystemResourceMonitor` | License ≠ hardware |
| `KhepreeAccessService` + heartbeat | Fail-closed |
| `LiveSessionRecoveryService` | Startup crash recovery (no auto-resume) |

`focusedAccountId` = **UI navigation only**.

---

## Platform

| Feature | Status | Notes |
| --- | --- | --- |
| Electron + typed preload | IMPLEMENTED | |
| Account-aware IPC | IMPLEMENTED | |
| Schema migrations | IMPLEMENTED | Current `CURRENT_SCHEMA_VERSION = 4` |
| App event channel | IMPLEMENTED | `APP_EVENT` + coalesced sync; slow full fallback |
| Batch start ready / stop all | IMPLEMENTED | Main-process; renderer không loop startLive |
| Vitest + CI | IMPLEMENTED | Includes smoke gate |
| Real smoke harness | IMPLEMENTED | Docs + gated script; results local-only |

## Licensing (Khepree)

| Feature | Status | Notes |
| --- | --- | --- |
| Access key + fail-closed start | IMPLEMENTED | |
| Capacity feature keys | PARTIAL | Client convention; platform seed pending |
| PKCE / lease / heartbeat | PARTIAL | **REAL_SMOKE_PENDING** production pin |
| Dev mock limits | IMPLEMENTED | |

## AI / LLM / Media

| Feature | Status | Notes |
| --- | --- | --- |
| Mock LLM | IMPLEMENTED | |
| Gemini worker path | REAL_SMOKE_PENDING | Wired; default prefs may be mock until operator connects |
| Sales brain + policy guard | PARTIAL | Grounding from Product DNA |
| Fallback script | PARTIAL | When Gemini degraded |
| TTS + local preview | IMPLEMENTED | Windows SAPI; Voice UI tab |
| Avatar / MuseTalk | NOT_IMPLEMENTED | |
| Virtual camera / virtual audio | NOT_IMPLEMENTED | |

## TikTok

| Feature | Status | Notes |
| --- | --- | --- |
| Worker registry | REAL_SMOKE_PENDING | |
| LIVE Manager registry | REAL_SMOKE_PENDING | |
| Comment → bus → feed | REAL_SMOKE_PENDING | Path + isolation tested with stubs |
| Order / violation | FOUNDATION_ONLY | Selectors incomplete |
| Fake revenue UI | NOT_IMPLEMENTED | Intentional |

## Product / UX

| Feature | Status | Notes |
| --- | --- | --- |
| Product DNA CRUD | IMPLEMENTED | |
| Live Center + Account Detail | IMPLEMENTED | Takeover banner, emergency stop |
| Voice settings page | IMPLEMENTED | Replaces Coming Soon on avatar tab |
| Script / Logs tabs | FOUNDATION_ONLY | Coming Soon placeholders |
| VI/EN i18n | IMPLEMENTED | |

## Commercial

| Feature | Status | Notes |
| --- | --- | --- |
| Production-ready claim | **NOT_IMPLEMENTED** | Dev milestone only |
| Installer / signing / auto-update | FOUNDATION_ONLY / NOT_IMPLEMENTED | |

---

## Test map (automated)

| Area | Test |
| --- | --- |
| Cross-account events | `tests/multi-live/cross-account-events.test.ts` |
| Stop B leave A/C | `tests/multi-live/stop-lifecycle.test.ts` |
| Batch start/stop | `tests/multi-live/batch-start.test.ts` |
| Session epoch / stale AI | `tests/session-epoch/stale-ai-result.test.ts` |
| Approval session bind | `tests/approval/session-binding.test.ts` |
| Cross-source dedupe | `tests/events/cross-source-dedupe.test.ts` |
| App events | `tests/events/app-event-channel.test.ts` |
| Resources | `tests/resources/system-resource-monitor.test.ts` |
| Media queues | `tests/media/per-account-voice.test.ts` |
| Takeover | `tests/operator/takeover.test.ts` |
| Crash recovery | `tests/session-recovery/crash.test.ts` |
| Scheduler fairness | `tests/llm-scheduler/fairness.test.ts` |

Manual: `docs/REAL_SMOKE_TEST.md`.
