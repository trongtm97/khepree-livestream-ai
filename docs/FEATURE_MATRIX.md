# Feature matrix — Khepree Livestream AI

Nguồn sự thật: **source code hiện tại** (rà lại sau Prompt 01–12 / media foundation, 2026-09-05).

- **Development milestone:** `0.4.x` = media routing + avatar foundation
- **package.json version:** `0.1.0` (chưa bump production release)
- **Gate:** `npm run typecheck` · `npm test` · `npm run test:foundation` · `npm run test:smoke:gate`
- **Media real smoke:** `docs/MEDIA_REAL_SMOKE_TEST.md` (GATE A–F) — **chưa PASS** trên máy thật trong repo này

## Status legend

| Status | Nghĩa |
| --- | --- |
| **IMPLEMENTED** | Đã viết, đã nối vào app, có Vitest/wiring rõ |
| **PARTIAL** | Có hành vi thật trong app, còn thiếu mảnh quan trọng |
| **FOUNDATION_ONLY** | Có type/class/sidecar/file, wiring mỏng hoặc pack rỗng |
| **REAL_SMOKE_PENDING** | Code local/mock đủ dùng, **chưa** PASS trên tài khoản/API/hardware thật |
| **NOT_IMPLEMENTED** | Không có code có nghĩa |

---

## Honest real-smoke flags

| Area | Status |
| --- | --- |
| TikTokLive thật (3 account concurrent) | **REAL_SMOKE_PENDING** — `docs/REAL_SMOKE_TEST.md` + MEDIA GATE A |
| LIVE Manager selector pack trên UI thật | **REAL_SMOKE_PENDING** |
| Gemini Web login / generate thật | **REAL_SMOKE_PENDING** |
| 3-account audio routing isolation | **REAL_SMOKE_PENDING** — MEDIA GATE B |
| 2-account virtual camera isolation | **REAL_SMOKE_PENDING** — MEDIA GATE C (architecture only) |
| Avatar realtime ≥ target FPS | **REAL_SMOKE_PENDING** — MEDIA GATE D |
| Takeover stops only target account (media too) | **REAL_SMOKE_PENDING** — MEDIA GATE E |
| Crash recovery with media processes | **REAL_SMOKE_PENDING** — MEDIA GATE F |
| Khepree production lease key pin | **REAL_SMOKE_PENDING** |
| Windows clean install / Squirrel | **NOT_IMPLEMENTED** / FOUNDATION_ONLY config |

Operator: `npm run test:smoke:demo` (CI) vs `KHEPREE_REAL_SMOKE=1 npm run test:smoke:real` (manual).

---

## Milestone 0.4.x — media routing + avatar foundation

| Feature | Status | Evidence |
| --- | --- | --- |
| Live output modes (`ASSIST_ONLY`…`AVATAR_LIVE`) | **IMPLEMENTED** | `live-output-mode.ts`; Voice UI; start gate |
| Windows audio endpoint / virtual cable routing | **PARTIAL** + **REAL_SMOKE_PENDING** | `windows-audio-bridge`, AudioRoutingSetupWizard; Vitest; GATE B pending |
| AvatarProvider abstraction | **IMPLEMENTED** | `AvatarProvider` + Mock / LiveTalking / MuseTalk-local |
| LiveTalking external adapter (no bundle) | **PARTIAL** + **REAL_SMOKE_PENDING** | HTTP client + docs; no in-repo model download |
| MuseTalk local Windows worker | **PARTIAL** + **REAL_SMOKE_PENDING** | `workers/avatar_musetalk_worker` mock default; GATE D pending |
| Avatar library + create wizard | **IMPLEMENTED** | `AvatarLibraryService`; schema `avatar_assets` v8 |
| SceneEngine + SceneCompositor + local preview | **IMPLEMENTED** | Per-account preview; SET_SCENE + manual override |
| VideoOutputProvider + reservation | **IMPLEMENTED** (mock) / **REAL_SMOKE_PENDING** (Windows) | Mock dual cams PASS; `WindowsVirtualCameraOutput` stub |
| Virtual camera feasibility | **FOUNDATION_ONLY** | `docs/VIRTUAL_CAMERA_FEASIBILITY.md`; no driver chosen |
| GpuMediaScheduler (≠ AiRequestScheduler) | **IMPLEMENTED** | Admission before AVATAR_LIVE; mock capacity tests |
| Media Readiness Center | **IMPLEMENTED** | Account detail tab; dry-run + 3-account token test (local) |

---

## Must-record areas (core + 0.3 carry-forward)

| Feature | Status | Evidence |
| --- | --- | --- |
| Multi-account runtime | **IMPLEMENTED** | `MultiLiveRuntimeManager`; `tests/multi-live/*` |
| TikTok per-account worker | **REAL_SMOKE_PENDING** | Registry + worker; stub Vitest |
| LIVE Manager per-account | **REAL_SMOKE_PENDING** | Registry + Playwright profiles |
| AI scheduler (Gemini queue) | **IMPLEMENTED** | `AiRequestScheduler` |
| Session lifecycle / epoch / crash recovery | **IMPLEMENTED** | Generation + `LiveSessionRecoveryService` |
| Approval session isolation | **IMPLEMENTED** | Session-bound approvals |
| Cross-source event dedupe | **IMPLEMENTED** | `LiveEventDeduplicator` |
| TTS | **IMPLEMENTED** | Windows SAPI → WAV; operator SAPI voices **REAL_SMOKE_PENDING** |
| Media session | **IMPLEMENTED** | Voice + Composite (TTS → audio + avatar) |
| Human takeover | **IMPLEMENTED** | `OperatorControlService`; media-path GATE E pending |
| Resource monitoring | **IMPLEMENTED** | `SystemResourceMonitor` + ResourceGovernor |
| Avatar (product claim “shipping ready”) | **REAL_SMOKE_PENDING** | Foundation exists; not FPS-proven |
| Virtual camera (product claim) | **NOT_IMPLEMENTED** / architecture stub | Do not claim multi-cam working |
| Virtual audio (stream path) | **PARTIAL** | Endpoint routing coded; GATE B isolation pending |

---

## AppContainer wiring (truth)

`src/main/app-container.ts` gắn:

| Service | Notes |
| --- | --- |
| SQLite + repositories | Through **schema v8** (`media_profiles`, `avatar_assets`, output modes, …) |
| `MultiLiveRuntimeManager` | Per-account `LiveRuntime` + SceneEngine + batch start/stop |
| `TikTokConnectorRegistry` / `LiveManagerRegistry` | Per-account |
| `LlmProviderManager` + `AiRequestScheduler` | Fair Gemini queue + stale discard |
| `GpuMediaScheduler` | Avatar GPU slots / VRAM admit (separate from AI scheduler) |
| `MediaSessionFactory` | Voice / Composite + avatar providers |
| `AvatarLibraryService` | Operator avatar assets |
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
| Account-aware IPC | IMPLEMENTED | Includes media readiness / scene / avatar |
| Schema migrations | IMPLEMENTED | `CURRENT_SCHEMA_VERSION = 8` |
| App event channel | IMPLEMENTED | |
| Batch start ready / stop all | IMPLEMENTED | |
| Vitest + CI | IMPLEMENTED | Media unit tests included |
| Real smoke harness | IMPLEMENTED | `REAL_SMOKE_TEST` + `MEDIA_REAL_SMOKE_TEST`; results local-only |

## Licensing (Khepree)

| Feature | Status | Notes |
| --- | --- | --- |
| Access key + fail-closed start | IMPLEMENTED | |
| Capacity feature keys | PARTIAL | Client convention; platform seed pending |
| PKCE / lease / heartbeat | PARTIAL | **REAL_SMOKE_PENDING** production pin |
| Output-mode license hook | FOUNDATION_ONLY | Keys reserved; not enforced |
| Dev mock limits | IMPLEMENTED | |

## AI / LLM / Media

| Feature | Status | Notes |
| --- | --- | --- |
| Mock LLM | IMPLEMENTED | |
| Gemini worker path | REAL_SMOKE_PENDING | |
| Sales brain + policy guard | PARTIAL | Product DNA grounding |
| Fallback script | PARTIAL | |
| TTS + local / endpoint audio | PARTIAL | Endpoint routing REAL_SMOKE_PENDING isolation |
| Avatar engines (LiveTalking / MuseTalk) | PARTIAL | Adapters + worker; realtime FPS REAL_SMOKE_PENDING |
| Scene engine + local preview | IMPLEMENTED | No virtual camera required |
| Virtual camera | NOT_IMPLEMENTED | Feasibility + mock only |
| GpuMediaScheduler | IMPLEMENTED | Mock capacity; hardware admit REAL_SMOKE_PENDING |
| Media Readiness Center | IMPLEMENTED | |

## TikTok

| Feature | Status | Notes |
| --- | --- | --- |
| Worker registry | REAL_SMOKE_PENDING | |
| LIVE Manager registry | REAL_SMOKE_PENDING | |
| Comment → bus → feed | REAL_SMOKE_PENDING | Stub isolation tested |
| Order / violation | FOUNDATION_ONLY | |
| Fake revenue UI | NOT_IMPLEMENTED | Intentional |

## Product / UX

| Feature | Status | Notes |
| --- | --- | --- |
| Product DNA CRUD | IMPLEMENTED | Optional imagePaths for scenes |
| Live Center + Account Detail | IMPLEMENTED | Media readiness tab |
| Voice + avatar hub | IMPLEMENTED | Output modes, wizards |
| Script / Logs tabs | FOUNDATION_ONLY | Coming Soon placeholders |
| VI/EN i18n | IMPLEMENTED | |

## Commercial

| Feature | Status | Notes |
| --- | --- | --- |
| Production-ready claim | **NOT_IMPLEMENTED** | Dev milestone 0.4.x only |
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
| Output modes | `tests/media/live-output-mode.test.ts` |
| Audio routing | `tests/media/audio-endpoint-routing.test.ts`, `audio-routing-wizard.test.ts` |
| Avatar isolation / adapters | `tests/media/avatar-provider-isolation.test.ts`, `livetalking-*.test.ts`, `musetalk-*.test.ts` |
| Avatar library | `tests/media/avatar-library.test.ts` |
| Scene engine | `tests/media/scene-engine.test.ts` |
| Video output mock | `tests/media/video-output-provider.test.ts` |
| GPU media scheduler | `tests/media/gpu-media-scheduler.test.ts` |
| Media readiness | `tests/media/media-readiness.test.ts` |
| Takeover | `tests/operator/takeover.test.ts` |
| Crash recovery | `tests/session-recovery/crash.test.ts` |
| Scheduler fairness | `tests/llm-scheduler/fairness.test.ts` |

Manual: `docs/REAL_SMOKE_TEST.md`, `docs/MEDIA_REAL_SMOKE_TEST.md`.
