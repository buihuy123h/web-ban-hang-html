# Trợ lý AI chat kiểu RAG — tư vấn khách hàng trên web

- **Ngày:** 2026-09-22
- **Loại:** Tính năng mới (FE + BE)
- **Trạng thái:** Đã duyệt bởi chủ repo — *cập nhật 2026-09-22: chuyển provider từ Google Gemini sang **xKiro** (AI API router chuẩn OpenAI, gói Free 500.000 token/ngày + 37 model miễn phí). Đã triển khai hoàn chỉnh BE + FE; test 30/30 pass.*
- **Tham chiếu:** `AGENTS.md` mục 3 · https://xkiro.com (API chuẩn OpenAI: `POST /v1/chat/completions`)

## 1. Mục tiêu & bối cảnh

Khách vào web muốn hỏi nhanh về món hàng, giá, giao hàng, thu mua đồ cũ… mà chưa cần gọi
điện/nhắn Zalo. Cần một **trợ lý AI chat** dạng widget nổi, kiểu **RAG**:

1. **Retrieval** — chấm điểm 21 sản phẩm (`server/data/products.json`) + FAQ chính sách
   (`server/data/chat-knowledge.json`) theo từ khoá câu hỏi (bỏ dấu tiếng Việt, so khớp mượt).
2. **Augmentation** — ghép dữ liệu truy xuất được vào prompt tiếng Việt kèm persona shop.
3. **Generation** — gọi **xKiro** (AI API router chuẩn OpenAI, gói Free 500.000 token/ngày)
   từ server bằng `fetch` builtin (Node ≥18, **0 dependency mới** — đúng triết lý repo).

Quy mô 21 món → **không dùng** vector DB/embedding: keyword scoring là đủ chính xác, tức thời.

**An toàn vận hành:** khi chưa cấu hình `XKIRO_API_KEY` (hoặc xKiro lỗi/quá hạn) → endpoint
tự **hạ cấp** sang chế độ `fallback` (trả lời rule-based từ kết quả truy xuất) — web không
bao giờ chết vì AI; CI/test không cần key, không gọi API ngoài.

## 2. User story

> Là khách ghé web, tôi muốn bấm nút "Hỏi trợ lý AI", gõ câu hỏi bằng tiếng Việt (có dấu
> hay không đều được) và nhận câu trả lời đúng dữ liệu shop kèm gợi ý món hàng bấm vào
> xem được ngay — để quyết định mua nhanh mà không phải chờ shop trả lời tin nhắn.

## 3. Luật nghiệp vụ

- Trợ lý **chỉ** trả lời dựa trên: products.json + chat-knowledge.json (thông tin shop, FAQ).
- AI **không được bịa** món hàng/giá/chính sách; không có dữ liệu thì nói thật + mời Zalo 0374 034 430.
- Câu hỏi ngoài phạm vi shop → khéo léo từ chối, đưa về chủ đề mua bán.
- Giá hiển thị đúng số liệu server (VNĐ, format `vi-VN`).
- Chat không lưu hội thoại phía server (stateless — prompt tự chứa, không lưu ở xKiro).
- Giới hạn an toàn: ≤ 20 tin/lượt gửi, ≤ 1.000 ký tự/tin, chat rate limit riêng
  (mặc định 12 tin/phút/IP, đè bằng `CHAT_RATE_MAX`) — song song với rate limit `/api` sẵn có.
- Môi trường test: **buộc** chế độ fallback, không bao giờ gọi xKiro thật.

## 4. Hợp đồng API — `POST /api/chat`

**Request:**
```json
{ "messages": [ { "role": "user", "content": "Shop còn ghế nhựa không?" } ] }
```
- `messages`: mảng 1–20 phần tử, mỗi phần `{ role: "user" | "assistant", content: string }`.
- `content`: 1–1.000 ký tự sau trim. **Tin cuối cùng phải là `user`.**

**Response 200** (luôn `Cache-Control: no-store`):
```json
{
  "reply": "Dạ shop còn ghế nhựa bành lớn 85.000₫…",
  "mode": "ai",
  "products": [ { "id": 1, "name": "Ghế nhựa bành lớn (còn như mới)", "price": 85000 } ]
}
```
- `mode`: `"ai"` (xKiro trả lời) | `"fallback"` (chưa có key / xKiro lỗi → rule-based).
- `products`: tối đa 4 món khớp nhất `{ id, name, price }` — FE render chip bấm vào
  `/product/:id`; rỗng `[]` nếu không khớp.

**Lỗi:**
- `400` `{ "error": "Hội thoại chưa hợp lệ.", "problems": ["…"] }` — payload sai luật trên.
- `429` `{ "error": "Bạn nhắn hơi nhanh, chờ ít phút rồi hỏi tiếp nhé." }` — vượt chat rate limit.

**Cấu hình env (server/.env — xem server/.env.example):**
`XKIRO_API_KEY` (lấy tại https://xkiro.com) · `XKIRO_MODEL` (mặc định `qwen/qwen3.5-flash:free`) ·
`XKIRO_API_BASE` (mặc định `https://api.xkiro.com/v1`) ·
`XKIRO_TIMEOUT_MS` (mặc định 20000) · `CHAT_RATE_MAX` (mặc định 12).

## 5. Phạm vi thay đổi file

| Vai trò | File |
|---|---|
| BE | `server/lib/chat.js` (mới — engine RAG + route handler) |
| BE | `server/data/chat-knowledge.json` (mới — thông tin shop + FAQ) |
| BE | `server/server.js` (sửa — nạp `.env`, gắn route `/api/chat`) |
| BE | `server/.env.example` (mới) · `.gitignore` (mở khoá `!server/.env.example`) |
| BE | `server/test/chat.test.js` (mới) · `server/docs/CHATBOT.md` (mới — hướng dẫn vận hành) |
| FE | `client/src/api/chat.js` (mới) · `client/src/components/ChatWidget.jsx/.css` (mới) |
| FE | `client/src/components/ContactFab.jsx/.css` (sửa — thêm mục "Hỏi trợ lý AI") |
| FE | `client/src/App.jsx` (sửa — state mở/đóng chat) |

## 6. Acceptance criteria (Given/When/Then)

1. **BE — hợp lệ:** Given server chạy, When `POST /api/chat` với 1 tin user hợp lệ,
   Then 200 với `reply` (string ≥1 ký tự), `mode ∈ {ai, fallback}`, `products` là mảng ≤4
   phần tử `{id, name, price}` lấy từ catalog thật.
2. **BE — truy xuất sản phẩm:** When hỏi "còn ghế nhựa cho quán không" (viết không dấu
   "ghe nhua" cũng tính), Then `products` chứa ít nhất 1 món ghế nhựa thật của shop.
3. **BE — truy xuất FAQ:** When hỏi về ship/freeship/địa chỉ, Then reply (fallback) chứa
   nội dung đúng chính sách (freeship 500.000₫, phí 30.000₫/45.000₫, kho 707 Tân Sơn…).
4. **BE — validate:** When gửi thiếu `messages` / role lạ / tin cuối là assistant / content
   >1.000 ký tự / >20 tin, Then 400 kèm `problems`.
5. **BE — rate limit chat:** When vượt `CHAT_RATE_MAX` tin trong 1 phút từ cùng IP,
   Then 429.
6. **BE — fallback an toàn:** Given không có `XKIRO_API_KEY` (hoặc test env), When hỏi
   hợp lệ, Then vẫn 200 trả lời được (mode `fallback`), không treo, không gọi mạng ngoài.
7. **FE — mở chat:** Given mọi trang, When bấm ContactFab → "Hỏi trợ lý AI", Then panel
   chat mở với lời chào + câu hỏi mẫu; Esc/bấm đóng để đóng panel.
8. **FE — hội thoại:** When gõ câu hỏi + Enter, Then tin khách hiện phải, bong bóng
   "đang nhập" hiện trong lúc chờ, câu trả lời hiện trái kèm chip món hàng bấm vào
   `/product/:id` (bấm thì đóng chat).
9. **FE — lỗi hiển thị:** When backend lỗi/mất kết nối, Then bong bóng lỗi thân thiện + tự
   focus lại ô nhập, không vỡ UI.
10. **Verify:** `npm test` (server) toàn bộ pass (21 test cũ không regress);
    `npm run build` (client) pass; `npm run verify` pass.

## 7. Ghi chú triển khai

- Gọi xKiro bằng **chat completions chuẩn OpenAI** (`POST {XKIRO_API_BASE}/chat/completions`,
  header `Authorization: Bearer <key>`), body `{ model, messages: [{role:"user", content: prompt}],
  temperature, max_tokens }` — persona + dữ liệu RAG nhét trọn vào 1 prompt duy nhất;
  parse `choices[0].message.content` + phòng hoả (content dạng mảng mảnh `{type:"text"}`).
- undici (fetch builtin của Node) thỉnh thoảng gặp lỗi transient `UND_ERR_SOCKET`
  ("The socket connection was closed unexpectedly") khi kết nối bị cắt giữa chừng →
  `callXkiro` **tự thử lại 1 lần** (timeout / lỗi 4xx thì không thử lại — vô ích);
  lỗi hẳn thì hạ cấp fallback, khách vẫn được trả lời.
- `server.js` nạp `server/.env` bằng `process.loadEnvFile()` (Node ≥ 20.12; thiếu file/Node
  cũ thì bỏ qua).
- FE gọi API **chỉ qua** `client/src/api/` (hàm `sendChat`), tái dùng `formatPrice`
  (`client/src/utils/format.js`) cho chip giá — không nhúng dữ liệu vào bundle.
