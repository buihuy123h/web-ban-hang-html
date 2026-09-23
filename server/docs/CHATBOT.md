# Trợ lý AI chat (RAG) — hướng dẫn vận hành

> Endpoint `POST /api/chat` · engine: `server/lib/chat.js` · hợp đồng đầy đủ:
> `docs/tasks/2026-09-22-ai-chatbot-rag-tro-ly-khach-hang.md`

## 1. Luồng hoạt động (RAG 3 bước)

1. **Retrieval** — chấm điểm 21 sản phẩm (`data/products.json`) + FAQ (`data/chat-knowledge.json`)
   theo từ khoá câu hỏi (bỏ dấu tiếng Việt: "ghe nhua" ≈ "Ghế nhựa").
2. **Augmentation** — ghép persona shop + dữ liệu truy xuất được vào prompt tiếng Việt.
3. **Generation** — có `XKIRO_API_KEY` thì gọi xKiro (`POST https://api.xkiro.com/v1/chat/completions`,
   chuẩn OpenAI) sinh câu trả lời; mọi lỗi → **fallback rule-based** — web không bao giờ chết vì AI.

## 2. Bật AI (tùy chọn — web vẫn chạy đầy đủ nếu không bật)

1. Lấy key tại https://xkiro.com (đăng ký → Create an API key; gói Free 500.000 token/ngày).
2. Copy `server/.env.example` → `server/.env`, điền `XKIRO_API_KEY=...`.
3. Khởi động lại server (`npm run dev:server` hoặc `npm start`). Xong — không sửa code thêm.

Kiểm tra AI đã hoạt động: response của `/api/chat` có `"mode": "ai"`.
`"mode": "fallback"` = chưa có key hoặc xKiro lỗi (kèm log `[chat] xKiro lỗi (…)`).

Đổi model chỉ cần sửa `XKIRO_MODEL` trong `server/.env`
(gợi ý cho tiếng Việt, miễn phí: `qwen/qwen3.5-flash:free`, `qwen/qwen3.7-flash:free`).

## 3. Biến môi trường (server/.env)

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `XKIRO_API_KEY` | *(rỗng → fallback)* | API key của xKiro |
| `XKIRO_MODEL` | `qwen/qwen3.5-flash:free` | Model sinh câu trả lời |
| `XKIRO_API_BASE` | `https://api.xkiro.com/v1` | Endpoint router (đổi khi xKiro nâng phiên bản) |
| `XKIRO_TIMEOUT_MS` | `20000` | Thời gian tối đa chờ AI mỗi lần gọi (ms) |
| `CHAT_RATE_MAX` | `12` | Số tin/phút/IP riêng cho `/api/chat` (song song rate limit `/api`) |

## 4. Dạy trợ lý thông tin mới

- **Sản phẩm / giá:** sửa `server/data/products.json` (FE luôn hiển thị giá theo server).
- **FAQ / chính sách / hotline:** sửa `server/data/chat-knowledge.json` — khi thêm FAQ mới,
  nhớ đặt `keywords` **viết thường, không dấu** để khách hỏi kiểu nào cũng trúng.
- Hai file JSON được nạp lúc server khởi động → **khởi động lại server** sau khi sửa.

## 5. Xử lý sự cố thường gặp

| Triệu chứng | Nguyên nhân & cách xử lý |
|---|---|
| Log `[chat] xKiro lỗi (HTTP 401/403)` | Sai hoặc hết hạn key → kiểm tra `XKIRO_API_KEY` trong `server/.env` |
| Log `[chat] xKiro lỗi (HTTP 402)` | Hết credit/token trong ngày → đợi reset hoặc nạp thêm (khách vẫn nhận fallback) |
| Log `[chat] xKiro lỗi (HTTP 429)` | Vượt giới hạn xKiro → tạm thời hạ cấp fallback; giảm `CHAT_RATE_MAX` nếu muồn |
| Log có "socket connection was closed unexpectedly" | Lỗi transient của undici — code đã **tự retry 1 lần**; vẫn thấy nhiều lần tức đường mạng tới xKiro kém (VPN/proxy/antivirus chặn) — khách vẫn nhận fallback bình thường |
| Trả lời không nhắc đúng món / chính sách | Món hoặc từ khoá chưa có trong dữ liệu → xem mục 4 |

## 6. Kiểm thử

- `npm test` (trong `server/`) — 30 test, gồm 9 test chat (fallback, khớp không dấu, validate 400,
  rate limit 429). Môi trường test **không** gọi xKiro thật.
- Test tay:
  `curl -X POST http://localhost:3000/api/chat -H "Content-Type: application/json" -d "{\"messages\":[{\"role\":\"user\",\"content\":\"shop con ghe nhua khong\"}]}"`