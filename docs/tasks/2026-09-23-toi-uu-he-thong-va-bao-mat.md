# Task: Tối ưu hệ thống & tăng cường bảo mật trước khi chạy thật

- **Ngày:** 2026-09-23 · **Người yêu cầu:** Chủ repo · **Thực hiện:** theo quy trình AGENTS.md (rút gọn [3] FRONTEND vì không đổi UI/client source)
- **Loại:** Backend (middleware/entry) — **không đổi hợp đồng API**, không đổi UI, không thêm dependency.

## 1. Mục tiêu & bối cảnh

Sau đợt audit 2026-09-23 dự án đã sạch lỗi và đủ chức năng. Task này bịt các điểm yếu còn lại để khi
deploy làm "ứng dụng thật" (có tên miền, chạy sau proxy/HTTPS) thì an toàn và ổn định hơn nữa:

- Quan sát thực tế qua smoke: response vẫn lộ `X-Powered-By: Express` (fingerprint framework).
- Chưa có `Content-Security-Policy` (CSP) — lớp chống XSS mạnh nhất của browser.
- CORS mở `Access-Control-Allow-Origin: *` cho mọi origin — không cần thiết vì web chạy cùng origin.
- Body > 100KB hiện rơi vào nhánh 500 chung (express ném `entity.too.large`) thay vì 413 đúng chuẩn.
- JSON API chỉ nén gzip dù hầu hết browser hỗ trợ Brotli (gọn hơn ~15-20%).
- Tiến trình chưa có bộ xử lý `unhandledRejection`/`uncaughtException` (lỗi treo âm thầm hoặc crash không dấu vết).

## 2. User story

> Là chủ shop, tôi muốn web khi đưa lên tên miền thật không bị khai thác (chèn script, nhúng iframe,
> lạm dụng API từ site lạ) và không sập tiếng không — để khách mua hàng liên tục được.

## 3. Quyết định kỹ thuật (đã khảo sát toàn bộ code liên quan)

| # | Vấn đề | Giải pháp | Vì sao an toàn |
|---|---|---|---|
| 1 | Lộ `X-Powered-By: Express` | `app.disable('x-powered-by')` | Chỉ bỏ 1 header; grep xác nhận không test/tool nào phụ thuộc |
| 2 | Không CSP | Thêm CSP strict cho mọi response | Đã rà nguồn tải thật: script chỉ 'self' (dist/index.html không inline script), style tự viết + Google Fonts (`fonts.googleapis.com`), font woff2 (`fonts.gstatic.com`), ảnh 'self' + `data:` (favicon), Maps iframe (`www.google.com`). Dev Vite :5173 không dính (Express chỉ serve bản build) |
| 3 | CORS `*` | Mặc định KHÔNG gắn ACAO (same-origin); bật qua `CORS_ORIGIN` (phân tách phẩy) | Dev qua Vite proxy = same-origin; production serve cùng origin. Grep xác nhận không test nào assert ACAO |
| 4 | Body quá lớn → 500 | Nhận diện `entity.too.large` → 413 JSON tiếng Việt | Đúng chuẩn HTTP |
| 5 | JSON chỉ gzip | Ưu tiên Brotli (quality 5), lùi về gzip; cache nén theo `<etag>\|<encoding>` (max 128) | Client chỉ chấp nhận gzip (test hiện có + curl) vẫn nhận gzip như cũ |
| 6 | Thiếu HSTS | `Strict-Transport-Security: max-age=15552000` chỉ khi `req.secure` hoặc `x-forwarded-proto: https` | HTTP thường không gắn; browser bỏ qua HSTS qua HTTP nên vô hại kể cả header giả |
| 7 | Crash âm thầm | `unhandledRejection` → log; `uncaughtException` → log + graceful shutdown + exit code 1 | Process manager (PM2/NSSM/CI) restart lại sạch; DB pool được đóng |
| 8 | Thiếu COOP | `Cross-Origin-Opener-Policy: same-origin` | Web không phụ thuộc cross-origin window.opener |

**Không làm (tránh lặp lại khảo sát):**
- Cache catalog in-memory: phá test `repository-injection` đang pass (đổi data giữa 2 request phải thấy
  ngay) — luật 6.5 cấm sửa test đang pass. ETag/304 + cache nén đã tiết kiệm phần lớn.
- Cluster mode / PM2 / đổi kiến trúc vận hành: ngoài thẩm quyền agent (AGENTS.md 6.2).
- Thêm `helmet`/`compression`: luật 6.2 cấm thêm dependency — tự viết đã đủ cho nhu cầu thực tế.
- CI smoke job cần SQL Server service container: chờ chủ repo duyệt (đã ghi QA doc 2026-09-23 trước).

## 4. Hợp đồng API

**Không đổi** method/path/body/response. Chỉ thêm/sửa HTTP header:

- Mọi response: **thêm** `Content-Security-Policy`, `Cross-Origin-Opener-Policy: same-origin`; **bỏ** `X-Powered-By`.
- Response qua HTTPS (trực tiếp hoặc `x-forwarded-proto: https`): **thêm** `Strict-Transport-Security: max-age=15552000`.
- CORS: **bỏ** mặc định `Access-Control-Allow-Origin: *`; chỉ echo origin nằm trong `CORS_ORIGIN` (kèm `Vary: Origin`).
- Body JSON > 100KB: đổi 500 → `413 {"error":"Dữ liệu gửi lên quá lớn (tối đa 100KB)."}`.
- JSON ≥ 1KB với client hỗ trợ Brotli: `Content-Encoding: br` (client chỉ gzip → gzip như cũ; client không nén → identity).

## 5. Acceptance criteria (Given/When/Then)

1. **GIVEN** server chạy **WHEN** gọi bất kỳ API nào **THEN** response không còn `X-Powered-By`, có
   `Content-Security-Policy` chứa `default-src 'self'`, `script-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`.
2. **WHEN** gọi API qua HTTP thường **THEN** không có HSTS; **WHEN** gửi kèm `X-Forwarded-Proto: https` **THEN** có HSTS `max-age ≥ 15552000`.
3. **WHEN** gửi `Origin` nằm trong `CORS_ORIGIN` **THEN** có ACAO echo đúng origin + `Vary: Origin`;
   origin lạ **THEN** không có ACAO; preflight OPTIONS từ origin lạ → 204 không ACAO.
4. **WHEN** POST body JSON > 100KB **THEN** 413 + JSON error tiếng Việt (không 500).
5. **WHEN** GET /api/products với `Accept-Encoding: gzip, br` **THEN** `Content-Encoding: br` và giải nén
   ra đúng JSON; chỉ `gzip` **THEN** `gzip` như cũ; ETag/304 vẫn hoạt động.
6. **WHEN** chạy `npm test` (server) **THEN** toàn bộ 39 test cũ + bộ test mới cùng pass.
7. **WHEN** chạy `npm run build` **THEN** exit 0.
8. **WHEN** chạy server thật + `npm run smoke` **THEN** 15/15 pass — chứng minh CSP không làm hỏng UI
   thật (Google Fonts, Maps embed, bundle, ảnh, chat widget).
9. **WHEN** smoke tạo đơn test **THEN** xóa đơn khỏi SQL Server, DB trở về đúng 5 đơn gốc.

## 6. Phạm vi file

- **Sửa:** `server/app.js`, `server/middleware/security-headers.js`, `server/middleware/cors.js`,
  `server/middleware/error-handler.js`, `server/middleware/json-gzip.js`, `server/index.js`,
  `server/.env.example`, `README.md`, `client/README.md` (đoạn mô tả bảo mật).
- **Thêm:** `server/test/security-hardening.test.js`, file này.
- **Không sửa:** `client/src/**` (không đổi UI), models/controllers (không đổi logic), CI/CD, `package.json`.

## 7. Kết quả thực hiện & ghi chú hợp nhất 2 phiên (2026-09-23, 11:15)

**Sự cố:** trong lúc thực hiện, một phiên AI khác chạy song song đã sửa cùng lúc chính các file
này (10:46–11:10). Chủ repo quyết định **gộp nhất**, giữ điểm mạnh cả hai bên. Kết quả cuối:

| Thành phần | Nguồn gốc | Ghi chú |
|---|---|---|
| Ẩn `X-Powered-By`, Brotli JSON + ETag/304, CSP, COOP | Phiên này | json-gzip.js giữ nguyên từ phiên này |
| COOP + HSTS sau proxy | Cả hai (hội tụ) | Phiên kia tự thêm lại cho khớp test của phiên này |
| HSTS chỉ tin proxy đã khai báo `TRUST_PROXY` | Phiên kia | An toàn hơn tin `X-Forwarded-Proto` mù |
| CORS: production same-origin (cấm `*`), dev `*`, validate env fail-fast, preflight lạ → 204 | Phiên kia | Test của phiên này giữ làm chuẩn |
| `X-Request-Id` + log truy vết + sanitize CRLF | Phiên kia | |
| Rate limit: refactor + riêng POST /api/orders (10/phút) + bucket cap | Phiên kia | |
| 413 body quá lớn + no-store mọi lỗi + log request_id | Cả hai | Phiên này dọn nhánh 413 trùng |
| Fatal handler (`uncaughtException`/`unhandledRejection` → shutdown mã 1) | Cả hai | Phiên kia dọn handler kép; có test chống đăng ký trùng |
| `parseTrustProxy` + `ConfigError` fail-fast cấu hình | Phiên kia | |
| Bộ test `security-hardening.test.js` | Phiên này (7 test) → phiên kia mở rộng (thêm ~10) | 57/57 tổng toàn server |
| `.env.example` mục HTTP production | Phiên này gộp 2 đoạn trùng | |
| CI SQL container, runbook, least-privilege | Riêng của phiên kia | Xem `docs/qa/2026-09-23-san-sang-production-va-bao-mat.md` |

**Kết quả verify cuối** (sau hợp nhất, code cuối 11:10):
- `npm test` → **57/57 pass** (39 gốc + 18 security/DB mới)
- `npm run build` → **exit 0** (Vite 72 modules + precompress 32 bản nén, tiết kiệm ~230 KB Brotli)
- Smoke Playwright → **15/15 PASS** (chạy 2 lần với 2 mốc code)
- Kiểm tra console CSP (trang chủ + /contact) → **0 lỗi**, Google Font Nunito tải thật
- Header thực tế: có CSP/COOP/`X-Request-Id`; không `X-Powered-By`; HSTS không gắn trên HTTP thường (đúng)
- DB sau dọn 2 đơn test smoke (`DI41947334`, `DI41357717`): **đúng 5 đơn / 12 items gốc**

**Lưu ý cho chủ repo khi review git:**
- Đổi `server/package.json`: bỏ `prestart` free-port (production không tự giết tiến trình), `engines.node` `>=20.12` → `>=22` (theo runbook Node 22 LTS) — **root `package.json` vẫn `>=20.12`, cân nhắc đồng bộ**.
- Khi deploy thật: đặt `NODE_ENV=production` (CORS chặt + fail-fast TLS) theo `server/docs/PRODUCTION-RUNBOOK.md`.

