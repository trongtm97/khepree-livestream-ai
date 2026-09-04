# Đánh giá mã nguồn & kiểm tra luồng — v0.1.0 foundation

Ngày đánh giá: 2026-09-04
Phạm vi: toàn bộ repository tại commit `a292c70` (foundation) + các thay đổi trên branch này.

---

## 0. Tóm tắt

Kiến trúc nền tảng của dự án **tốt và đúng hướng**: phân tách tiến trình Electron sạch (contextIsolation, sandbox, preload chỉ expose API kiểu), adapter hóa các connector bên ngoài, Product DNA làm nguồn sự thật duy nhất, Approval Engine fail-closed với danh sách rủi ro không bao giờ tự động. Triết lý "human-supervised autonomy" được thể hiện nhất quán trong code chứ không chỉ trong tài liệu.

Tuy nhiên khi chạy thật, có **4 lỗi mức nghiêm trọng** khiến phần mềm không thể dùng cho một buổi live dài, và **1 lỗi chặn hoàn toàn việc đóng gói**. Tất cả đã được sửa và có test chứng minh.

| # | Mức độ | Vấn đề | Trạng thái |
|---|--------|--------|------------|
| 1 | 🔴 Nghiêm trọng | Approval Engine giữ vô hạn — rò rỉ bộ nhớ/CPU theo thời gian live | ✅ Đã sửa |
| 2 | 🔴 Nghiêm trọng | Một subscriber lỗi làm crash tiến trình chính Electron | ✅ Đã sửa |
| 3 | 🟠 Cao | Race condition: bấm duyệt trễ hiện dialog lỗi dù hành động đã thành công | ✅ Đã sửa |
| 4 | 🟠 Cao | `npm run package` / `npm run make` **hoàn toàn không chạy được** | ✅ Đã sửa |
| 5 | 🟠 Cao | Không có test runner nào (`npm test` không tồn tại) | ✅ Đã bổ sung |
| 6 | 🟡 Trung bình | AI soạn được lời nhưng **không bao giờ phát ra tiếng** | ✅ Đã bổ sung TTS |
| 7 | 🟡 Trung bình | Dữ liệu session ghi vào DB nhưng **không bao giờ đọc lại** | ✅ Đã bổ sung |
| 8 | 🟡 Trung bình | Không có nút "dừng khẩn cấp" theo đúng triết lý sản phẩm | ✅ Đã bổ sung |
| 9 | 🟡 Trung bình | Polling renderer không xử lý lỗi, không pause khi ẩn cửa sổ | ✅ Đã sửa |
| 10 | 🟢 Nhỏ | `final_state` của session ghi sai trạng thái kết thúc | ✅ Đã sửa |

---

## 1. Các lỗi nghiêm trọng

### 1.1 Approval Engine giữ vô hạn (rò rỉ bộ nhớ + CPU)

**File:** `src/main/live/approval-engine.ts`

`ApprovalEngine` lưu mọi proposal vào một `Map` và **không bao giờ xóa**. `listPending()` quét toàn bộ Map đó, và nó được gọi mỗi lần renderer lấy snapshot (mỗi 1,2 giây).

Đo thực tế, giả lập một buổi live bận rộn:

```
20.000 approvals -> retained: 20000        (map không bao giờ dọn)
1200x listPending: 438 ms                 (mỗi lần snapshot phải quét 20k phần tử)
```

Một buổi live 8 tiếng với ~1 bình luận/giây tạo ra ~30.000 mục. Bộ nhớ tăng liên tục, mỗi snapshot ngày càng chậm — đúng vào lúc operator cần UI phản hồi nhanh nhất.

**Đã sửa:**
- Giới hạn giữ lại (`maxRetained`, mặc định 400) và thời gian sống cho mục đã xử lý (`resolvedTtlMs`, 10 phút).
- Thêm `pendingTtlMs` (5 phút): một câu trả lời soạn từ 10 phút trước trên livestream là vô dụng, nên tự hết hạn thay vì treo mãi.
- `pendingIds` được theo dõi riêng nên `listPending()` không còn quét lịch sử.

Sau sửa:
```
20.000 approvals -> retained: 400
1200x listPending: 0 ms
```

> Lưu ý thiết kế: mục **đang chờ** chỉ bị hết hạn theo thời gian, không bao giờ bị xóa vì lý do dung lượng. Operator luôn thấy mọi thứ mình còn có thể xử lý.

---

### 1.2 Một subscriber lỗi làm crash cả ứng dụng

**File:** `src/main/core/event-bus.ts`

```ts
const wrapped = (event) => void Promise.resolve(handler(event));
```

`void` trên một promise bị reject tạo ra **unhandled rejection**. Trong Electron main process, điều này kết thúc tiến trình — tức là một lỗi Gemini có thể tắt toàn bộ app giữa buổi live.

Xác nhận bằng thực nghiệm:

```
UNHANDLED REJECTION from bus: Error: LLM boom
```

**Đã sửa:** mọi handler được bọc try/catch (cả sync lẫn async), lỗi được cô lập và chuyển qua kênh `onError()` để log/chẩn đoán. Subscriber khác vẫn chạy bình thường.

---

### 1.3 Race condition khi operator bấm duyệt trễ

**File:** `src/main/live/approval-engine.ts`, `src/main/live/live-orchestrator.ts`

Ở chế độ `SUPERVISED_AUTO`, mỗi đề xuất có countdown 3,5 giây. Nếu operator bấm "Duyệt" ngay sau khi countdown vừa tự kích hoạt, `resolve()` ném `Error: Approval item not pending`, và UI hiện **dialog lỗi** cho một hành động thực tế đã thành công.

```
auto-fired: 1
OPERATOR CLICK RACE -> Approval item not pending
```

Đây không phải trường hợp hiếm: nó xảy ra mỗi khi người dùng bấm chậm vài trăm mili-giây.

**Đã sửa:** `resolve()` trở nên **idempotent** — bấm trễ là no-op, trả về trạng thái hiện tại thay vì ném lỗi. Tương tự cho `cancelAutoApprove()`.

---

### 1.4 Không đóng gói được ứng dụng (lỗi có sẵn, chặn phát hành)

`npm run package` và `npm run make` **thất bại hoàn toàn** ở bản gốc:

```
error during build:
src/main/core/event-bus.ts (1:9): "EventEmitter" is not exported by "__vite-browser-external"
```

Nguyên nhân: `vite.main.config.ts` chỉ khai báo `external` cho `better-sqlite3` và `playwright`, bỏ qua các builtin của Node. Vite thay `node:events` bằng stub trình duyệt.

Lỗi này **đã tồn tại trước các thay đổi của tôi** (đã kiểm chứng bằng cách stash toàn bộ thay đổi và build lại trên mã gốc).

**Đã sửa:** thêm `electron` và toàn bộ `builtinModules` (cả dạng `node:*`) vào `external`. Cả 3 bundle (main / preload / renderer) hiện build sạch:

```
dist/main.js     191.42 kB │ gzip: 53.70 kB
dist/preload.js  374.57 kB │ gzip: 111.30 kB
dist/assets/...  374.54 kB │ gzip: 111.27 kB
```

---

## 2. Kiểm tra luồng (flow)

Sơ đồ luồng trong `docs/ARCHITECTURE.md` khớp với hiện thực. Các điểm đã kiểm chứng bằng test:

**Luồng bình luận → lời nói**
```
TikTok comment → EventBus → scoreComment
  → (score < 45: bỏ qua, không gọi LLM — đúng)
  → LLM sinh ActionProposal
  → PolicyGuard (Product DNA grounding)
  → ApprovalEngine (chế độ quyết định auto hay chờ)
  → MediaProvider.speak()
```

**Các chốt an toàn xác nhận hoạt động đúng:**
- ✅ Bình luận nhiễu/kém quan trọng bị bỏ qua **trước** khi gọi LLM (tiết kiệm chi phí).
- ✅ Risk tag `medical`, `legal`, `refund_dispute`, `warranty_dispute`, `unknown_fact`… **không bao giờ** tự động duyệt, kể cả ở `FULL_AUTO`.
- ✅ Chống bịa thông tin: thử nói "Còn size M" khi **chưa có** Product DNA → bị chặn, chuyển `ASK_OPERATOR`. Khi Product DNA có size M → cho phép. Đây là quy tắc quan trọng nhất (#9 trong AGENTS.md) và nó hoạt động.
- ✅ Chống lặp lại: câu trả lời gần giống câu vừa nói sẽ được sinh lại một lần với gợi ý chống lặp.
- ✅ LLM lỗi → rơi về `ASK_OPERATOR` chứ không crash.

**Các lỗ hổng trong luồng đã phát hiện:**

| Vấn đề | Đã xử lý |
|--------|----------|
| `stop()` để lại proposal cũ, phiên sau có thể nói lại câu của phiên trước | `stop()` giờ xóa toàn bộ hàng đợi |
| `stop()` ghi `final_state = "WELCOME"` thay vì trạng thái kết thúc thực sự | Chuyển `stateMachine.stop()` lên trước callback |
| Renderer poll 1,2s không có xử lý lỗi: một lần IPC lỗi → unhandled rejection, và UI kẹt | Poll thích ứng: 900ms khi live, 2,5s khi rảnh, backoff lũy thừa khi lỗi, tạm dừng khi ẩn cửa sổ |
| `MediaManager.speak()` có thể ném lỗi ngược lên orchestrator | Bọc toàn bộ đường thoại trong try/catch |

---

## 3. Những gì đã bổ sung

### 3.1 Giọng đọc thật (TTS) — khoảng trống lớn nhất

**Vấn đề:** AI soạn được câu trả lời nhưng `MediaProvider` duy nhất là `MockMediaProvider`, hàm `speak()` chỉ `console.log`. Phần mềm livestream bán hàng mà không phát ra tiếng thì chưa thành sản phẩm.

**Bổ sung:**
- `src/main/connectors/media/system-tts-provider.ts` — TTS offline dùng engine có sẵn của hệ điều hành: Windows SAPI, macOS `say`, Linux `espeak-ng`. Đúng định hướng local-first: không API key, không tính tiền theo ký tự, không phụ thuộc internet.
- `src/main/connectors/media/media-manager.ts` — lớp điều phối: tự động chọn adapter, hàng đợi chống nói chồng, giới hạn độ dài câu, và **công tắc tắt tiếng AI** (human takeover).
- `src/shared/media-contracts.ts` — trạng thái public cho renderer.

**Bảo mật:** văn bản do AI sinh **không bao giờ** được ghép vào chuỗi lệnh. Trên macOS/Linux truyền qua argv; trên Windows truyền qua **biến môi trường** đọc bởi một script PowerShell tĩnh (`-EncodedCommand`), nên đầu ra của model không thể thoát ra shell.

**Tôn trọng quy tắc:** khi không có engine nào, panel hiện rõ "chưa tìm thấy bộ đọc giọng" thay vì giả vờ AI đang nói.

### 3.2 Nút dừng khẩn cấp

Theo triết lý "human-supervised autonomy", operator phải có nút dừng AI tức thì. `emergencyStop()` trong một hành động: tắt tiếng ngay lập tức → hủy mọi đề xuất đang chờ → chuyển về `MANUAL_ASSIST`.

**Quan trọng:** nút này **không dừng livestream** — người bán vẫn ở trên sóng, chỉ có AI ngừng tự hành động. Nút "Dừng trợ lý AI" riêng vẫn dùng để kết thúc phiên.

### 3.3 Trang Lịch sử (đọc lại dữ liệu đã lưu)

`live_sessions`, `live_events`, `approvals` được ghi nhưng **không có mã nào đọc lại**. Bổ sung `SessionHistoryRepository` + trang Lịch sử (thay tab "Nhật ký" vốn chỉ là coming-soon): thời lượng, số bình luận, số đơn, bao nhiêu câu AI đã nói, bao nhiêu câu bị từ chối, và xem lại từng câu trả lời kèm risk tag.

### 3.4 Bộ test

Dự án được thiết kế để "AI coding agent phát triển lặp lại" nhưng **không có test runner nào** — chỉ có các hàm `assert*()` tự kiểm tra rải rác.

Bổ sung Vitest với **74 test** bao phủ các luồng cốt lõi:

| File test | Số test | Nội dung |
|-----------|---------|----------|
| `tests/approval-engine.test.ts` | 16 | Chốt an toàn risk tag, race condition, giới hạn bộ nhớ, countdown |
| `tests/live-orchestrator.test.ts` | 26 | Luồng end-to-end comment → lời nói, 4 chế độ tự động, chống bịa thông tin, vòng đời phiên |
| `tests/event-bus.test.ts` | 6 | Cô lập lỗi subscriber |
| `tests/media-manager.test.ts` | 16 | Human takeover, giới hạn độ dài, chọn giọng |
| `tests/session-history.test.ts` | 10 | SQL chạy trên SQLite thật |

Chạy: `npm test`

---

## 4. Đánh giá theo tiêu chí

| Tiêu chí | Đánh giá | Ghi chú |
|----------|----------|---------|
| Phân tách tiến trình Electron | ⭐⭐⭐⭐⭐ | contextIsolation + sandbox + preload kiểu, không lọt secret |
| Adapter hóa connector | ⭐⭐⭐⭐⭐ | Gemini/TikTok/Media đều sau interface, dễ thay |
| Chốt an toàn AI | ⭐⭐⭐⭐⭐ | Risk tag, grounding, approval — đúng và nhất quán |
| Chống bịa thông tin | ⭐⭐⭐⭐⭐ | Product DNA grounding hoạt động tốt |
| Quản lý bộ nhớ dài hạn | ⭐⭐ → ⭐⭐⭐⭐⭐ | Đã sửa rò rỉ |
| Chịu lỗi khi chạy | ⭐⭐ → ⭐⭐⭐⭐ | Đã cô lập lỗi |
| Đóng gói / phát hành | ❌ → ⭐⭐⭐⭐ | Build hoàn toàn hỏng, đã sửa |
| Kiểm thử | ❌ → ⭐⭐⭐⭐ | Từ không có lên 74 test |
| Hoàn thiện tính năng | ⭐⭐⭐ | Thiếu TTS (đã thêm), avatar, camera ảo, analytics |

---

## 5. Khuyến nghị tiếp theo

Theo thứ tự ưu tiên trong `docs/NEXT_IMPLEMENTATION_PHASES.md`:

1. **Push event thay vì polling.** Renderer vẫn poll snapshot. Với luồng sự kiện dày, nên chuyển sang đẩy từ main qua IPC (`webContents.send`) để giảm tải serialize toàn bộ snapshot mỗi giây.
2. **Khepree licensing thật** — vẫn đang dùng `KHEPREE_DEV_MOCK=1`, chưa có signing key production.
3. **Gemini connector thật** — onboarding bằng Firefox + cookie mã hóa.
4. **Selector pack LIVE Manager** — hiện pack nền tảng có selector rỗng, cần chạy trên tài khoản live thật.
5. **Watchdog** (§61 tài liệu gốc) — phát hiện stall: Gemini treo, TikTok mất kết nối lâu, GPU quá tải. Circuit breaker đã có cho LLM; cần mở rộng cho media và browser.
6. **Avatar / camera ảo** (phase 10–11) — vẫn là khoảng trống lớn nhất còn lại.
7. **Chạy smoke test installer trên Windows thật** — hiện mới chỉ verify được bundle build, chưa chạy được Electron (môi trường này không có display).

---

## 6. Cách kiểm chứng

```bash
npm install
npm run typecheck      # ✅ 0 lỗi
npm test               # ✅ 74 test
npm run test:foundation # ✅ PASS
npm run package        # ✅ build được (đã sửa)
```

> Ghi chú: `npm run package` / `make` cần chạy trên Windows để sinh installer. Trong môi trường này mới verify được bước bundle (`vite build`) vì không có display để chạy Electron.
