# Feature matrix — Khepree Livestream AI

Nguồn sự thật cho trạng thái chức năng **trong repository hiện tại**. Không phát triển tính năng mới từ file này; dùng để tránh làm trùng, làm sai lớp, hoặc phá kiến trúc.

- Phiên bản repo được rà: `0.1.0` foundation
- Ngày rà: 2026-09-04
- Gate tĩnh đã chạy: `npm run test:foundation` → **PASS** (12 file/contract). Đây **không** phải live smoke.
- Quy tắc: không gắn **IMPLEMENTED** cho tích hợp live (Khepree production, Gemini, TikTok, installer) nếu chưa có smoke test thật.

## Cách đọc trạng thái

| Status | Nghĩa |
| --- | --- |
| **IMPLEMENTED** | Đã viết, đã nối vào app đang chạy, đủ việc đã nêu. Chỉ dành cho hạ tầng local hoặc mock đã wire. |
| **FOUNDATION_ONLY** | Có type/class/sidecar/file, nhưng **chưa nối** `AppContainer` / IPC / UI / Event Bus, hoặc pack còn rỗng. |
| **PARTIAL** | Có hành vi thật trong app, còn thiếu mảnh quan trọng hoặc chưa smoke. |
| **NOT_IMPLEMENTED** | Không có code có nghĩa. |

## Bản đồ wiring hiện tại

`AppContainer` (`src/main/app-container.ts`) **đang** gắn:

- SQLite + `ProductRepository` + `ApprovalRepository` + `LiveEventRepository` (repo events **không được gọi**)
- `LiveEventBus`
- `KhepreeAccessService` + `KhepreeHeartbeatService`
- `MockLlmProvider` (không phải Gemini)
- `MockMediaProvider` (console.log, không TTS)
- `LiveOrchestrator`

**Không** gắn: `GeminiWorkerProvider`, `TikTokWorkerProvider`, `LiveManagerObserver`, loader `resources/policy-packs`, loader selector pack, worker restart, session repository.

Renderer chỉ nói chuyện qua preload typed API — đúng kiến trúc. Snapshot health chỉ hỏi mock LLM + mock media.

---

## Platform

| Module | Feature | Status | File hiện tại | Thiếu gì |
| --- | --- | --- | --- | --- |
| Platform | Electron shell (sandbox, `contextIsolation`, fuses, Forge/Vite) | IMPLEMENTED | `src/main/window.ts`, `src/main/index.ts`, `forge.config.ts` | Chưa smoke bản đóng gói trên máy Windows sạch |
| Platform | Single-instance + custom protocol `khepreelivestreamai://` | IMPLEMENTED | `src/main/index.ts`, `package.json` `protocols` | Callback OAuth live vẫn cần smoke Khepree |
| Platform | Preload typed API | IMPLEMENTED | `src/preload/index.ts`, `src/types/global.d.ts` | — |
| Platform | IPC | PARTIAL | `src/shared/ipc.ts`, `src/main/ipc/register.ts` | `GEMINI_HEALTH` khai báo nhưng không register/expose. TikTok IPC cố ý ném `TIKTOK_CONNECTOR_NOT_ENABLED_IN_FOUNDATION` |
| Platform | SQLite open + WAL + migrate | IMPLEMENTED | `src/main/db/connection.ts` | Không có migration versioning ngoài `CREATE IF NOT EXISTS` |
| Platform | SQLite products persistence | PARTIAL | `src/main/db/repositories.ts` `ProductRepository` | Chỉ `list/get/save`. Không `delete`. UI chỉ title/price |
| Platform | SQLite `live_events` persistence | FOUNDATION_ONLY | `src/main/db/connection.ts`, `LiveEventRepository` | `AppContainer.events` tạo ra nhưng không `save` từ orchestrator |
| Platform | SQLite `live_sessions` | FOUNDATION_ONLY | `src/main/db/connection.ts` | Không repository, không start/stop session row |
| Platform | SQLite approvals persistence | PARTIAL | `ApprovalRepository`, `LiveOrchestrator.onApprovalChanged` | Snapshot đọc queue **in-memory**, không reload từ DB khi restart |
| Platform | SQLite `secrets` table | FOUNDATION_ONLY | `src/main/db/connection.ts` | Không code đọc/ghi. Secret thật nằm file |
| Platform | Electron `safeStorage` (device key + refresh token) | IMPLEMENTED | `src/main/khepree/device-identity-service.ts`, `session-store.ts` | Fail nếu DPAPI không có (`SAFE_STORAGE_UNAVAILABLE`). Chưa vault cookie Gemini |
| Platform | Worker process helper (localhost + bearer) | PARTIAL | `src/main/workers/http-worker-process.ts` | Có spawn, token, startup timeout. Không restart, không gắn AppContainer |

## Licensing (Khepree)

| Module | Feature | Status | File hiện tại | Thiếu gì |
| --- | --- | --- | --- | --- |
| Licensing | Catalog identity (slug, client id, redirect, plans) | IMPLEMENTED | `src/shared/khepree-catalog.ts` | Khớp `foundation-check`. Catalog platform phải khớp bên repo Khepree |
| Licensing | PKCE + mở browser authorize | PARTIAL | `src/main/khepree/pkce.ts`, `khepree-access-service.ts` `startLogin` | Chưa smoke production |
| Licensing | Deep-link callback → `/desktop/auth/exchange` | PARTIAL | `src/main/index.ts`, `khepree-api-client.ts` `exchange` | Unwrap `{ data }` đã có. Chưa smoke |
| Licensing | Device Ed25519 identity | PARTIAL | `device-identity-service.ts` | Chưa smoke activate/deviceProof trên API thật |
| Licensing | Encrypted refresh token | PARTIAL | `session-store.ts` | Chưa smoke cold-start refresh |
| Licensing | Access token memory-only | IMPLEMENTED | `khepree-access-service.ts` (field private; renderer chỉ `KhepreePublicState`) | — |
| Licensing | Activate device | PARTIAL | `khepree-api-client.ts` `activate`, `ensureActivated` | Chưa smoke; `ENTITLEMENT_MISSING` được nuốt có chủ đích |
| Licensing | Signed lease verification | PARTIAL | `lease-verifier.ts` | Unpackaged **bỏ chữ ký** nếu thiếu `KHEPREE_LICENSE_SIGNING_PUBLIC_KEY`. Packaged fail-closed khi thiếu key |
| Licensing | Pin production signing public key | NOT_IMPLEMENTED | `.env.example` để trống | Phải pin key trước khi ship |
| Licensing | Heartbeat 60s + resume/unlock | PARTIAL | `heartbeat-service.ts` | Không refresh `/me` sau heartbeat; chưa smoke revocation |
| Licensing | Fail-closed `assertProductAccess` | IMPLEMENTED | `khepree-access-service.ts`, `ipc/register.ts` | Gate `LIVE_START`, `LIVE_SET_MODE`, `PRODUCT_SAVE`. Phụ thuộc mock hoặc lease thật |
| Licensing | Dev mock `KHEPREE_DEV_MOCK=1` | IMPLEMENTED | `config.ts`, `initialize()` | Chỉ unpackaged |
| Licensing | `/desktop/me` + public state + UI license | PARTIAL | `khepree-access-service.ts`, `src/renderer/ui/App.tsx` Setup tab | Renderer poll 1.2s, không subscribe `onChange`. Một số copy EN/VI lẫn |
| Licensing | Plans list + checkout handoff | PARTIAL | `listPlans`, `createCheckout`, Setup tab | Mở `handoffUrl` rồi dừng |
| Licensing | Checkout status polling | FOUNDATION_ONLY | `khepree-api-client.ts` `checkoutStatus` | Method có, **không gọi** sau checkout |
| Licensing | Production live smoke (PKCE + activate + heartbeat) | NOT_IMPLEMENTED | — | `docs/PROJECT_STATE.md` cố ý không claim. `test:foundation` chỉ check file |

## AI

| Module | Feature | Status | File hiện tại | Thiếu gì |
| --- | --- | --- | --- | --- |
| AI | `LlmProvider` interface | IMPLEMENTED | `src/main/connectors/llm/types.ts` | — |
| AI | Mock LLM (wired) | IMPLEMENTED | `mock-llm-provider.ts`, `app-container.ts` | Chỉ dev stand-in; không phải sales brain production |
| AI | Gemini Python worker | FOUNDATION_ONLY | `workers/gemini_worker/app.py` | `/health` `/v1/init` `/v1/models` `/v1/generate`. Không do Electron spawn |
| AI | `GeminiWorkerProvider` | FOUNDATION_ONLY | `gemini-worker-provider.ts` | **Không** import trong `AppContainer` |
| AI | Gemini authentication (browser cookies / `secure1PSID`) | FOUNDATION_ONLY | `workers/gemini_worker/app.py` `InitRequest` | Provider luôn `authMode: "browser"`. Không UI, không Firefox helper |
| AI | Gemini encrypted cookie settings | NOT_IMPLEMENTED | — | README nói "future encrypted settings UI" |
| AI | Gemini model selection | FOUNDATION_ONLY | worker `GET /v1/models`; provider `listModels` | Không IPC/UI chọn model. `generate` có field `model` nhưng UI không gửi |
| AI | Gemini health (operator-visible) | FOUNDATION_ONLY | provider `health()`, `IPC.GEMINI_HEALTH` | IPC không register. Snapshot không hỏi Gemini |
| AI | Gemini → `ActionProposal` JSON | FOUNDATION_ONLY | `generateActionProposal` + prompt schema | Parse JSON mỏng manh; không stream; chưa nối orchestrator |
| AI | Streamed structured JSON | NOT_IMPLEMENTED | — | Phase Gemini onboarding trong `NEXT_IMPLEMENTATION_PHASES.md` |
| AI | Retry / circuit breaker | NOT_IMPLEMENTED | — | Worker ném HTTP 502, không backoff |
| AI | Fallback brain / script engine | NOT_IMPLEMENTED | — | `ARCHITECTURE.md` mô tả tương lai. Mock LLM là default, không phải fallback khi Gemini chết |

## TikTok

| Module | Feature | Status | File hiện tại | Thiếu gì |
| --- | --- | --- | --- | --- |
| TikTok | `TikTokProvider` interface | IMPLEMENTED | `src/main/connectors/tiktok/types.ts` | — |
| TikTok | TikTokLive Python worker | FOUNDATION_ONLY | `workers/tiktok_worker/app.py` | FastAPI + buffer 5000 events. Electron không spawn |
| TikTok | `TikTokWorkerProvider` | FOUNDATION_ONLY | `tiktok-worker-provider.ts` | Không gắn container / Event Bus |
| TikTok | Connect / disconnect IPC + UI | FOUNDATION_ONLY | `ipc/register.ts`, Setup tab copy "SMOKE REQUIRED" | Handler ném lỗi cố ý. UI không có ô `@uniqueId` |
| TikTok | Comments | FOUNDATION_ONLY | worker `CommentEvent` | Có normalize. Chưa vào Event Bus |
| TikTok | Likes | FOUNDATION_ONLY | worker `LikeEvent` | Orchestrator **bỏ** mọi type trừ `COMMENT` và `ORDER_ACTIVITY` |
| TikTok | Follows | FOUNDATION_ONLY | worker `FollowEvent` | Như trên |
| TikTok | Shares | FOUNDATION_ONLY | worker `ShareEvent` | Như trên |
| TikTok | Gifts | FOUNDATION_ONLY | worker `GiftEvent` | Như trên |
| TikTok | Viewer count | NOT_IMPLEMENTED | type `VIEWER_COUNT` trong `live-types.ts` | Worker không emit |
| TikTok | Reconnect / backoff | NOT_IMPLEMENTED | worker `409 already connected` | Không retry loop |
| TikTok | Event deduplication | NOT_IMPLEMENTED | — | LIVE Manager `scanVisibleEvents` sẽ trùng nếu poll lại |
| TikTok | Drain events → Event Bus | NOT_IMPLEMENTED | `drainEvents` trên provider | Không poller |
| TikTok | LIVE Manager Playwright observer | FOUNDATION_ONLY | `live-manager-observer.ts` | Không mở từ UI. `scanVisibleEvents` chỉ comment, fail-soft |
| TikTok | Selector packs | FOUNDATION_ONLY | `resources/selector-packs/tiktok-live-manager.foundation.json` | `commentRows` / `orderRows` / `violationRows` = `[]` |
| TikTok | LIVE Manager login profile | FOUNDATION_ONLY | `launchPersistentContext` `browser-profiles/tiktok-live-manager` | Không launcher/login UX |
| TikTok | Order feed | NOT_IMPLEMENTED | selector `orderRows` rỗng; type `ORDER_ACTIVITY` | Observer không scan order |
| TikTok | Violations | NOT_IMPLEMENTED | selector `violationRows` rỗng | Không scan |
| TikTok | TikTok products / `PIN_PRODUCT` executor | NOT_IMPLEMENTED | `live-orchestrator.ts` comment | Case `PIN_PRODUCT` no-op |

## Product

| Module | Feature | Status | File hiện tại | Thiếu gì |
| --- | --- | --- | --- | --- |
| Product | Product DNA schema | PARTIAL | `src/shared/live-types.ts` `ProductDNA` | Có variants/facts/claims/faq/`sourceUrl`. Thiếu field riêng size/color/stock/shipping |
| Product | Create (manual) | PARTIAL | `App.tsx` `ProductsTab`, `PRODUCT_SAVE` | Chỉ title + price; luôn UUID mới (không upsert) |
| Product | List / read | PARTIAL | `ProductRepository.list/get`, UI list | List chỉ hiện title/price |
| Product | Edit | NOT_IMPLEMENTED | — | Save luôn tạo id mới |
| Product | Delete | NOT_IMPLEMENTED | — | Không IPC delete |
| Product | Variants | FOUNDATION_ONLY | field `variants` | UI ghi `[]` |
| Product | Size | NOT_IMPLEMENTED | — | Chỉ pattern trong `comment-priority.ts` |
| Product | Color | NOT_IMPLEMENTED | — | Như trên |
| Product | Stock | NOT_IMPLEMENTED | — | Như trên |
| Product | Shipping | NOT_IMPLEMENTED | — | Như trên |
| Product | Facts | FOUNDATION_ONLY | field `facts` | UI trống; Mock LLM gần như không dùng |
| Product | Allowed / forbidden claims | FOUNDATION_ONLY | fields + `PolicyGuard` đọc `forbiddenClaims` | Không UI nhập; `allowedClaims` không enforce |
| Product | FAQ | FOUNDATION_ONLY | field `faq` | Không UI, brain không đọc |
| Product | Import URL | NOT_IMPLEMENTED | optional `sourceUrl` | Không importer |
| Product | CSV / Excel | NOT_IMPLEMENTED | — | — |

## Live intelligence

| Module | Feature | Status | File hiện tại | Thiếu gì |
| --- | --- | --- | --- | --- |
| Live | Event Bus | IMPLEMENTED | `src/main/core/event-bus.ts` | In-process only. Không publisher từ TikTok |
| Live | Sales State Machine | PARTIAL | `sales-state-machine.ts` | `start/stop/onEvent` dùng. `advance/pause/resume` không gọi. Không timer xoay kịch bản |
| Live | Comment priority | PARTIAL | `comment-priority.ts`, orchestrator threshold `< 45` | Heuristic VI/EN. Không UI score. Không persist |
| Live | Sales Brain (mock, wired) | IMPLEMENTED | `mock-llm-provider.ts` | Ground giá nếu có `priceText`; size thì câu chung |
| Live | Sales Brain (Gemini structured) | FOUNDATION_ONLY | `gemini-worker-provider.ts` | Chưa thay mock |
| Live | Short-term memory | FOUNDATION_ONLY | `recentSpeech` slice 20 trong orchestrator | RAM only, mất khi stop |
| Live | Session memory | NOT_IMPLEMENTED | bảng `live_sessions` | Không ghi |
| Live | Product memory | NOT_IMPLEMENTED | — | Chỉ `currentProductId` sau save |
| Live | Approval Engine | PARTIAL | `approval-engine.ts` | Countdown 3.5s, threshold 0.92, block risk tags. Không cancel UI cho countdown |
| Live | Approval UI approve / reject | PARTIAL | `App.tsx` Operator tab | Không sửa lời nói trên UI dù IPC có `editedSpeech` |
| Live | Approval edit speech | FOUNDATION_ONLY | `resolveApproval(..., editedSpeech)` | Không input |
| Live | Policy Guard | PARTIAL | `policy-guard.ts` | Hardcode empty-speech + forbiddenClaims + medical regex. Không load JSON pack |
| Live | Policy pack loader | FOUNDATION_ONLY | `resources/policy-packs/default.json` | File trùng ý ApprovalEngine, **không import** |
| Live | Action executor (speak / scene) | PARTIAL | `live-orchestrator.ts` `execute` | Gọi mock media. Không TTS thật |
| Live | Action executor (browser PIN) | NOT_IMPLEMENTED | — | — |
| Live | Live Orchestrator | PARTIAL | `live-orchestrator.ts` | Loop mock OK nếu tự publish event. Không ingest TikTok. Không persist events |
| Live | Automation modes | PARTIAL | types + UI select + engine | `SUPERVISED_AUTO` default. `FULL_AUTO` gate feature `full_auto` (mock = false). `MANUAL_ASSIST` không auto. Thiếu copy giải thích |
| Live | Demo event injection | NOT_IMPLEMENTED | `scripts/inject-demo-event.mjs` | Chỉ in note, không IPC |

## Media

| Module | Feature | Status | File hiện tại | Thiếu gì |
| --- | --- | --- | --- | --- |
| Media | `MediaProvider` interface | IMPLEMENTED | `src/main/connectors/media/types.ts` | `health/speak/stopSpeech/setScene` |
| Media | Mock media (wired) | IMPLEMENTED | `mock-media-provider.ts` | `console.info` only |
| Media | TTS | NOT_IMPLEMENTED | — | Toàn bộ adapter |
| Media | Avatar | NOT_IMPLEMENTED | — | LiveTalking / MuseTalk không có |
| Media | Lip-sync | NOT_IMPLEMENTED | — | — |
| Media | Scene runtime | FOUNDATION_ONLY | `setScene` trên interface + mock | Không renderer, không asset |
| Media | Virtual camera | NOT_IMPLEMENTED | — | — |
| Media | Virtual audio | NOT_IMPLEMENTED | — | — |
| Media | Interrupt (cắt lời AI) | NOT_IMPLEMENTED | `stopSpeech` trên mock | Không hotkey, không gắn mic |
| Media | Human takeover | NOT_IMPLEMENTED | — | V1 success criteria trong vision doc; code chưa có |

## UX

| Module | Feature | Status | File hiện tại | Thiếu gì |
| --- | --- | --- | --- | --- |
| UX | Vietnamese language | PARTIAL | `index.html` `lang="vi"`; một phần copy VI (license/splash) | UI chính EN ("Operator", "Start AI", …). Không i18n |
| UX | English language / locale switch | NOT_IMPLEMENTED | — | Không bộ locale |
| UX | Onboarding | NOT_IMPLEMENTED | — | — |
| UX | Help system | NOT_IMPLEMENTED | — | — |
| UX | Tooltips | NOT_IMPLEMENTED | — | — |
| UX | Setup wizard | NOT_IMPLEMENTED | tab Connectors | Panel stub Gemini/TikTok, không wizard |
| UX | Diagnostics | PARTIAL | health panel; `scripts/dev-doctor.mjs` | Doctor chỉ in Node/Python version. Không screenshot selector, không log viewer |
| UX | Beginner mode | NOT_IMPLEMENTED | — | — |
| UX | Advanced mode | NOT_IMPLEMENTED | — | Mode automation ≠ beginner/advanced |
| UX | Notifications | PARTIAL | Toast stack + `notify()` | Wired for feedback; not yet event-bus driven |
| UX | Error explanations | IMPLEMENTED | `src/shared/errors`, `src/renderer/errors`, ErrorDialog | Catalog VI/EN; technical details behind button; no alert() |
| UX | Operator dashboard | PARTIAL | `src/renderer/ui/App.tsx` | 3 tab: live controls, approval, products mỏng, license. Không feed comment |

## Commercial / reliability

| Module | Feature | Status | File hiện tại | Thiếu gì |
| --- | --- | --- | --- | --- |
| Commercial | Auto update | NOT_IMPLEMENTED | — | Không `electron-updater` |
| Commercial | Installer | FOUNDATION_ONLY | `forge.config.ts` `MakerSquirrel` + ZIP | Có config. Chưa smoke máy thật (`PROJECT_STATE.md`) |
| Commercial | Code signing | NOT_IMPLEMENTED | — | — |
| Commercial | Logs (`%APPDATA%\...\logs\`) | NOT_IMPLEMENTED | README nêu path | Chỉ `console.*`. Không writer, không log viewer |
| Commercial | Crash recovery | NOT_IMPLEMENTED | — | `before-quit` dispose. Không restore session |
| Commercial | Selector pack update | NOT_IMPLEMENTED | pack local rỗng | Không kênh ký/cập nhật |
| Commercial | Connector update | NOT_IMPLEMENTED | — | Workers copy vào `extraResource`; không updater |
| Commercial | Worker watchdog / restart | NOT_IMPLEMENTED | `HttpWorkerProcess` exit chỉ warn | Trái AGENTS.md rule 10 nếu coi worker là long-running production |
| Commercial | Foundation static check | IMPLEMENTED | `scripts/foundation-check.mjs` | File + catalog string + `{ data }` unwrap. Không runtime |
| Commercial | Live smoke tests | NOT_IMPLEMENTED | — | Khepree / Gemini / TikTok / installer |
| Commercial | Unit / integration tests | NOT_IMPLEMENTED | — | 0 file `*.test.*` / `*.spec.*` |
| Commercial | Telemetry opt-in | NOT_IMPLEMENTED | — | Ghi trong next phases |

## Phụ thuộc khai báo nhưng chưa dùng

| Item | Status | Ghi chú |
| --- | --- | --- |
| `zustand` | NOT_IMPLEMENTED | Có trong `package.json`, renderer dùng `useState` |
| Playwright | FOUNDATION_ONLY | Import trong observer, app không mở browser |

## Tổng hợp đếm

Đếm theo **mọi hàng Feature** trong các bảng Platform → Commercial (không đếm bảng phụ thuộc hay legend).

| Status | Số hàng |
| --- | --- |
| IMPLEMENTED | 17 |
| PARTIAL | 28 |
| FOUNDATION_ONLY | 31 |
| NOT_IMPLEMENTED | 50 |
| **Tổng** | **126** |

## 10 khoảng trống quan trọng nhất

1. **Khepree production smoke** — client gần đủ, chưa pin signing key, chưa poll checkout, chưa chứng minh PKCE/activate/heartbeat trên API thật.
2. **Gemini chưa vào AppContainer** — worker + provider có, app vẫn `MockLlmProvider`; không onboarding cookie/Firefox.
3. **TikTokLive chưa vào Event Bus** — worker normalize comment/like/follow/share/gift, IPC cố ý tắt.
4. **Không có reconnect / dedup / drain poller** — không thể coi ingestion là đáng tin.
5. **Product DNA UI chỉ title/price** — schema rộng hơn; seller không nhập fact/claim/variant → AI sẽ thiếu grounding.
6. **TTS + human takeover = không có** — approve chỉ `console.info`; không cắt lời, không mic người.
7. **LIVE Manager / selector / order / violation = sườn rỗng** — không backup khi TikTokLive gãy.
8. **Policy pack và session/event persistence chưa load/ghi** — guard hardcode; restart mất queue và không có lịch sử live.
9. **UX người mới thiếu** — không onboarding, wizard, i18n, tooltip, giải thích lỗi; UI song ngữ lẫn.
10. **Commercial runtime** — không log file, crash recovery, auto-update, signing, watchdog worker; installer chỉ config Forge.

## Task tiếp theo đề xuất

**Không** bắt đầu TTS/avatar/importer.

Task tiếp theo nên là **Prompt 02 — Khepree live acceptance**: đăng ký client/product trên platform, pin `KHEPREE_LICENSE_SIGNING_PUBLIC_KEY`, chạy smoke PKCE → exchange → activate → `/me` → heartbeat, poll checkout status, fail-closed khi thiếu entitlement. Khớp `docs/NEXT_IMPLEMENTATION_PHASES.md` mục 1 và điều kiện "không claim production-ready khi chưa smoke".

Sau đó: Gemini onboarding (wire provider + cookie vault + health), rồi TikTokLive → Event Bus (comment + reconnect + dedup). Chi tiết phạm vi V1: `docs/V1_SCOPE.md`.
