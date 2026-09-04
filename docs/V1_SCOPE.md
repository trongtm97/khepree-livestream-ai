# V1 scope — Khepree Livestream AI

Phạm vi **một seller thật sự dùng được** một phiên livestream có AI giám sát, không phải foundation demo.

Nguồn: `docs/ARCHITECTURE.md`, `docs/PROJECT_STATE.md`, `docs/NEXT_IMPLEMENTATION_PHASES.md`, `docs/FEATURE_MATRIX.md`, tiêu chí V1 trong vision nội bộ (login Khepree, Gemini, TikTok comment, Product DNA, duyệt, nói, takeover, không bịa fact).

Quy tắc:

- V1 = human-supervised autonomy. Default `SUPERVISED_AUTO`.
- Mọi hành động AI vẫn qua `ActionProposal` → Policy Guard → Approval Engine.
- Product facts chỉ từ Product DNA. Không hallucinate giá / size / stock / ship / bảo hành.
- Gemini Web và TikTokLive vẫn sidecar thay thế được.
- Không ship avatar đẹp, virtual camera, hay FULL_AUTO như điều kiện V1.
- Không gọi một mục MUST HAVE là xong nếu chưa smoke trên luồng thật.

Trạng thái hiện tại của từng mục: xem `docs/FEATURE_MATRIX.md`. Cột **Now** dưới đây là tóm tắt.

---

## V1 MUST HAVE

Thiếu một mục trong nhóm này = chưa được gọi là V1.

| # | Chức năng | Now | Ghi chú phạm vi V1 |
| --- | --- | --- | --- |
| 1 | Khepree login PKCE + session + fail-closed | PARTIAL | Seller đăng nhập, entitlement `livestream_ai.access`, revoke dừng Start AI. Bắt buộc smoke production. Pin signing key khi packaged |
| 2 | Mua / kích hoạt gói (tháng/năm) + biết vì sao bị khóa | PARTIAL | Checkout handoff + **poll status** + message lỗi tiếng Việt rõ |
| 3 | Operator UI tiếng Việt, đủ dùng | PARTIAL | Một ngôn ngữ chính VI. Không cần locale EN trong V1 |
| 4 | Product DNA nhập tay đủ grounding | PARTIAL | CRUD: title, giá, variants (size/màu), stock text, ship text, facts, forbidden claims, FAQ. Edit + xóa |
| 5 | Gemini worker **nối** AppContainer | FOUNDATION_ONLY | Health, init, generate `ActionProposal` JSON. Cookie/browser auth có UI settings mã hóa, không nằm renderer |
| 6 | Chọn model Gemini + thấy health | FOUNDATION_ONLY | Operator biết worker DOWN trước khi Start AI |
| 7 | TikTokLive **nối** Event Bus | FOUNDATION_ONLY | Connect `@uniqueId` từ UI. Comment realtime vào bus. Smoke account thật |
| 8 | Reconnect + dedup comment | NOT_IMPLEMENTED | Long-running: timeout, restart worker, operator thấy trạng thái |
| 9 | Comment priority + lọc spam | PARTIAL | Score hiện trên UI (dù đơn giản). Không bỏ comment mua hàng |
| 10 | Sales Brain grounded | Mock IMPLEMENTED; Gemini FOUNDATION_ONLY | Trả lời từ DNA; thiếu fact → `ASK_OPERATOR`, không bịa |
| 11 | Policy Guard trên speech | PARTIAL | Load pack + forbidden claims sản phẩm. Chặn claim y tế/cường điệu |
| 12 | Approval queue: duyệt / sửa / hủy | PARTIAL | Bắt buộc sửa lời nói trước approve. Countdown SUPERVISED_AUTO hủy được |
| 13 | Live Orchestrator end-to-end | PARTIAL | Comment → brain → guard → approval → **TTS thật** (local, một engine). Mock console không đủ V1 |
| 14 | TTS local ổn định | NOT_IMPLEMENTED | Một adapter nói được. Chưa cần CosyVoice/GPT-SoVITS song song |
| 15 | Human takeover hotkey | NOT_IMPLEMENTED | Dừng TTS ngay, operator nói. V1 không cần virtual mic phức tạp nếu takeover = mute AI + hiện “bạn đang nói” |
| 16 | Diagnostics tối thiểu | PARTIAL | Health Gemini / TikTok / Khepree / TTS trên UI. Lỗi có câu tiếng Việt |
| 17 | Log file local | NOT_IMPLEMENTED | `%APPDATA%\KhepreeLivestreamAI\logs\` — không secret |
| 18 | Electron shell an toàn (preload-only) | IMPLEMENTED | Giữ nguyên; không nới privilege renderer |

**Cố ý không** đưa vào MUST HAVE: avatar, lip-sync, virtual camera/audio, LIVE Manager order parsing, CSV import, auto-update, code signing, English i18n, FULL_AUTO.

---

## V1 SHOULD HAVE

Rất hữu ích; có thể cắt nếu block ngày ship. Không được làm trước MUST HAVE còn thiếu.

| # | Chức năng | Now | Vì sao nên có |
| --- | --- | --- | --- |
| 1 | Setup wizard 4 bước (Khepree → Product → Gemini → TikTok) | NOT_IMPLEMENTED | Seller không đọc docs |
| 2 | Help ngắn + tooltip trên control nguy hiểm | NOT_IMPLEMENTED | Giảm Start AI khi chưa DNA/Gemini |
| 3 | Gemini retry / circuit breaker | NOT_IMPLEMENTED | Web API dễ gãy |
| 4 | Likes / follows / shares / gifts vào bus (thank-you an toàn) | FOUNDATION_ONLY | Worker đã normalize; orchestrator đang ignore |
| 5 | LIVE Manager observer **comment** như nguồn phụ | FOUNDATION_ONLY | Backup khi TikTokLive chết. Selector phải smoke, không đoán |
| 6 | Persist live session + events | FOUNDATION_ONLY | Bảng đã có, chưa ghi |
| 7 | Policy pack theo thị trường (file, không hardcode) | FOUNDATION_ONLY | `resources/policy-packs/default.json` chưa load |
| 8 | Installer Squirrel chạy được trên Windows sạch | FOUNDATION_ONLY | Config Forge có; chưa smoke |
| 9 | Worker watchdog (crash → restart có giới hạn) | NOT_IMPLEMENTED | AGENTS.md rule 10 |
| 10 | Checkout status + refresh entitlement sau thanh toán | FOUNDATION_ONLY | API client đã có `checkoutStatus` |
| 11 | Fallback script khi Gemini DOWN (kịch bản xoay WELCOME→CTA, không bịa giá) | NOT_IMPLEMENTED | Giữ phiên sống; không thay Approval Engine |
| 12 | Dev IPC inject comment giả | NOT_IMPLEMENTED | Test loop không cần live TikTok |

---

## LATER (V2 / V3)

Không làm trong V1 trừ khi MUST HAVE đã xong và được yêu cầu riêng.

| Nhóm | Để sau | Lý do |
| --- | --- | --- |
| Media | Avatar, lip-sync, LiveTalking, MuseTalk, scene renderer, gesture | Vision V2. V1 chỉ cần giọng |
| Media | Virtual camera + virtual audio | Pipeline phức tạp, phụ thuộc driver Windows |
| TikTok | Order feed, violations, PIN_PRODUCT DOM, selector pack signed update | Selector thật + rủi ro reverse-engineering |
| Product | Import URL, CSV/Excel, AI enrichment | Seller V1 nhập tay được |
| Live | FULL_AUTO production, multi-live, agency, analytics, template marketplace | Policy + product gating |
| UX | English i18n, beginner/advanced skins, notification center | VI-first |
| Commercial | Auto-update, code signing, telemetry opt-in, connector marketplace | Sau khi có installer smoke |
| Platform | Nền tảng khác TikTok | V3 |

---

## Thứ tự hoàn thiện V1 (không làm song song lung tung)

Khớp `docs/NEXT_IMPLEMENTATION_PHASES.md` và không đụng kiến trúc:

1. **Khepree live acceptance** (MUST 1–2) — gate mọi thứ.
2. **UI tiếng Việt + lỗi rõ** (MUST 3, 16) — đủ để seller hoàn thành bước 1.
3. **Product DNA CRUD** (MUST 4) — grounding trước khi bật LLM thật.
4. **Gemini onboarding + wire provider** (MUST 5–6).
5. **TikTokLive → Event Bus** (MUST 7–9).
6. **Brain + guard + approval UX** (MUST 10–12) trên sự kiện thật.
7. **TTS + takeover** (MUST 13–15).
8. **Logs + health** (MUST 16–17).
9. SHOULD HAVE theo thứ tự: wizard → persist events → LIVE Manager comment backup → installer smoke.

Dừng nhận V1 khi 18 mục MUST HAVE đã smoke (trừ mục 18 shell — đã có, chỉ cần không phá).

---

## Ranh giới agent

- Không copy Gemini-API / TikTokLive vào core proprietary (`docs/THIRD_PARTY.md`).
- Không hard-code selector TikTok trong orchestrator.
- Không đưa secret Google/TikTok/Khepree xuống renderer.
- Không claim IMPLEMENTED cho connector live khi mới pass `test:foundation`.
