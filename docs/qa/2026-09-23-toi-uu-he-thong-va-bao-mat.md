# QA — Tối ưu hệ thống & tăng cường bảo mật

- **Ngày kiểm thử:** 2026-09-23 (giờ địa phương 10:44–11:20)
- **Task:** `docs/tasks/2026-09-23-toi-uu-he-thong-va-bao-mat.md`
- **Kết luận:** **PASS** — toàn bộ acceptance criteria của task đạt; không regression.
- **Tính chất đặc biệt:** trong phiên có **2 AI phiên chạy song song** cùng sửa (sự cố đã được
  chủ repo quyết định gộp — chi tiết mục "Sự cố"); mọi bằng chứng dưới đây đo trên **code sau hợp nhất**.

## Kết quả gate

| Gate | Kết quả | Bằng chứng |
|---|---|---|
| `npm test` (server, node:test) | ✅ PASS | **57/57 pass, 0 fail** (39 gốc + 18 mới của bộ security/DB) |
| `npm run build` (gốc repo) | ✅ PASS | exit 0 — Vite 72 modules; precompress 32 bản nén (Brotli tiết kiệm 229,8 KB) |
| Header thực tế (server :3000 + SQL Server thật) | ✅ PASS | Xem bảng header dưới |
| `npm run smoke` (Playwright UI thật) | ✅ PASS | **15/15 PASS** — chạy 2 lần (mốc code 11:05 và code cuối 11:08+), đặt hàng thật qua API |
| Kiểm tra console CSP | ✅ PASS | Trang chủ + /contact (Google Maps embed): **0 lỗi CSP / 0 request fail**; `document.fonts.check('16px Nunito')` → true |
| Dọn vết test | ✅ PASS | Xóa 2 đơn smoke `DI41947334` + `DI41357717` (cascade OrderItems) → DB về đúng **5 đơn / 12 items** gốc; `tools/artifacts/` chỉ còn `.gitkeep` |

## Bằng chứng header thực tế (curl :3000, code cuối)

```
X-Request-Id: 8fa9e47a-…                     ← mới: truy vết log (độc hại bị thay bằng UUID)
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Cross-Origin-Opener-Policy: same-origin        ← mới
Content-Security-Policy: default-src 'self'; script-src 'self';
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:;
  frame-src 'self' https://www.google.com https://maps.google.com;
  object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
X-RateLimit-Limit: 240 / X-RateLimit-Remaining: …
(KHÔNG còn X-Powered-By · KHÔNG HSTS trên HTTP thường — chỉ sau proxy HTTPS đã tin cậy)
GET /api/products (Accept-Encoding: gzip, br) → Content-Encoding: br, 3.738 byte (bản gốc ~12 KB)
```

## Đối chiếu acceptance criteria (mục 5 của task doc)

| # | Tiêu chí | Kết quả |
|---|---|---|
| 1 | Không `X-Powered-By`; CSP có default/script/frame-ancestors/object-src | ✅ (curl + test 1) |
| 2 | HTTP thường không HSTS; qua proxy HTTPS có HSTS | ✅ (curl + test 2 + test production của phiên kia) |
| 3 | CORS: whitelist echo + Vary; origin lạ không ACAO; preflight lạ 204 | ✅ (test 3) |
| 4 | Body > 100KB → 413 JSON (không 500) | ✅ (test 4) |
| 5 | Brotli khi client hỗ trợ; gzip như cũ; ETag/304 giữ nguyên | ✅ (test 5–6 + curl) |
| 6 | `npm test` pass (cũ + mới) | ✅ 57/57 |
| 7 | `npm run build` exit 0 | ✅ |
| 8 | Smoke 15/15 + CSP không phá UI (font, Maps, bundle, ảnh) | ✅ (2 lần) + console check 0 lỗi |
| 9 | Dọn đơn test, DB về 5 đơn gốc | ✅ (2 đơn đã xóa cascade) |

## Sự cố: 2 phiên AI chạy song song (đã xử lý theo quyết định chủ repo)

- **Diễn biến:** phiên thứ hai sửa cùng lúc chính các file của task này (10:46–11:10), tạo
  code trộn lẫn + trùng lặp (handler kép trong `index.js`, nhánh 413 chết trong
  `error-handler.js`, 2 đoạn env trùng trong `.env.example`) và đè mất một phần hiện thực.
- **Xử lý:** chủ repo chọn phương án **gộp nhất**; cả hai phiên tự hội tụ (phiên kia thêm lại
  COOP/HSTS cho khớp test của phiên này; phiên này dọn nốt 2 chỗ trùng còn lại). Bảng chi tiết
  nguồn gốc từng thành phần nằm ở mục 7 của task doc.
- **Bài học quy trình:** nên chạy **một** agent cho một khu vực file tại một thời điểm;
  nếu cần song song, phân vùng thư mục rõ ràng.

## Ghi chú khi đưa lên production (cho chủ repo)

1. **Đặt `NODE_ENV=production`** trong cấu hình service — khi đó CORS mặc định chỉ same-origin
   (cấm `*`) và guard TLS (`DB_TRUST_SERVER_CERTIFICATE=false` bắt buộc) kích hoạt. Chi tiết theo
   `server/docs/PRODUCTION-RUNBOOK.md`.
2. Chạy sau reverse proxy → đặt `TRUST_PROXY=1` (rate-limit đúng IP khách + HSTS hoạt động);
   tách domain FE/FE riêng → khai báo `CORS_ORIGIN`.
3. Chatbot thật → điền `XKIRO_API_KEY` vào `server/.env` (hiện fallback rule-based).
4. CI smoke cần SQL Server container + secret `CI_SQL_ADMIN_PASSWORD` — xem QA doc kia:
   `docs/qa/2026-09-23-san-sang-production-va-bao-mat.md` (NEEDS_INPUT).
5. Khác biệt nhỏ: `server/package.json` engines `>=22` (runbook Node 22) nhưng gốc repo
   `>=20.12` — cân nhắc đồng bộ khi commit.

## Handoff

```text
[HANDOFF] tester -> chủ repo
Task: docs/tasks/2026-09-23-toi-uu-he-thong-va-bao-mat.md · Status: DONE
Artifacts: server/middleware/* (security-headers, cors, json-gzip, error-handler, rate-limit, request-logger) · server/index.js · server/app.js · server/.env.example · server/test/security-hardening.test.js · README.md · client/README.md · docs/tasks/… · file này
Verify: npm test → 57/57 pass · npm run build → exit 0 · smoke → 15/15 PASS (×2) · CSP console 0 lỗi · DB về 5 đơn/12 items gốc
Next: chủ repo review git diff (lưu ý sự cố hợp nhất 2 phiên ở trên) + các việc NEEDS_INPUT trong docs/qa/2026-09-23-san-sang-production-va-bao-mat.md
```
