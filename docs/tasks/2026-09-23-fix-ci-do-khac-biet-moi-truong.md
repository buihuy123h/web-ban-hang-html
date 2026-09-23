# Task: Sửa 2 test đỏ trên GitHub Actions (vẫn xanh ở local)

- **Ngày:** 2026-09-23 · **Người yêu cầu:** Chủ repo · **Thực hiện:** Cline — quy trình rút gọn (bỏ [3] FRONTEND vì không đổi UI/client; giai đoạn [1] phân tích diễn ra trực tiếp trong hội thoại với chủ repo)
- **Loại:** Backend (middleware) + test — **không đổi hợp đồng API**, không đổi UI, không thêm dependency, không sửa `.github/workflows/`.

## 1. Mục tiêu & bối cảnh

Job backend trong `.github/workflows/ci.yml` chạy `npm test` đỏ **2/57** test dù máy dev Windows chạy xanh **57/57**. Log runner GitHub + tái hiện tại local xác định nguyên nhân là 2 khác biệt môi trường:

1. **GitHub Actions tự set `CI=true` trên mọi runner.** Test "DB config dùng Windows Authentication..." (`server/test/database.test.js:26`) không cô lập biến `CI` (các test cùng file đều set `CI: 'false'`) → `createConfig()` chạy với `CI=true`: Windows auth cho `DB_TRUST_SERVER_CERTIFICATE` mặc định `true` (`server/lib/db.js:37`) → luật fail-fast dòng 42–44 quăng `ConfigError`. Code production hành xử đúng thiết kế — thiếu sót nằm ở test.
2. **Job backend CI không build client** → không có `client/dist`. `setupClientServing()` (`server/middleware/serve-client.js`) return sớm khi chưa có dist → middleware bắt 404 cho `/images/*` (trước nằm trong `app.get('*')`) không được gắn → request ảnh không tồn tại rơi vào trang 404 mặc định của Express (`Content-Type: text/html`) → test "Ảnh không tồn tại..." (`server/test/api.test.js:317`) đỏ. (Test "Client build..." tự skip khi chưa build — `api.test.js:257` — nên vẫn "ok", dễ gây hiểu nhầm.)

Bằng chứng tái hiện ở local: chạy `CI=true npm test` → đúng test DB đỏ; đổi tên tạm `client/dist` → đúng test ảnh đỏ.

## 2. User story

> Là chủ repo, tôi muốn CI xanh phản chiếu đúng chất lượng code như ở local — để mỗi commit được kiểm chứng tự động thay vì đỏ oan vì khác biệt môi trường.

## 3. Giải pháp

| # | Vấn đề | Sửa | Vì sao an toàn |
|---|---|---|---|
| 1 | Test DB Windows-auth đọc lọt `CI=true` của runner | Dùng `withEnv` (pattern sẵn của cùng file) set `CI: 'false'`, `NODE_ENV: 'development'`, null các biến SQL sót lại (`DB_USER/DB_PASSWORD/DB_PORT/DB_ODBC_DRIVER/DB_TRUST_SERVER_CERTIFICATE/DB_ALLOW_SELF_SIGNED_CI`) | Không đổi assertion nào; chỉ cô lập môi trường — đúng ý đồ gốc của test (kiểm parse cấu hình máy dev) |
| 2 | Ảnh thiếu file → HTML 404 khi chưa build client | `serve-client.js`: `app.use('/images', → 404 'Not found')` đăng ký LUÔN (trước early-return dist); bỏ nhánh `/images/` (giờ unreachable) trong `app.get('*')`, giữ nhánh `/assets/` | Guard đứng SAU `express.static(IMAGES_DIR)` trong app.js nên ảnh thật vẫn phục vụ như cũ; khi đã có dist kết quả y như trước |

**Không làm:** sửa `.github/workflows/` (AGENTS.md 6.2 — cấm khi chưa duyệt); thêm bước build client vào job backend (CI chậm thêm, test "Client build..." vốn skip khi chưa build theo thiết kế sẵn).

## 4. Hợp đồng API

**Không đổi** method/path/body/response. Chỉ đổi hành vi 2 trường hợp biên (đều là hành vi đúng hơn):

- `GET /images/<file-không-tồn-tại>` khi **chưa có client/dist**: trước = trang 404 HTML mặc định của Express → sau = `404 "Not found"` (không Content-Type) — nhất quán với khi đã build.
- `GET /images` (path trần): trước = SPA index.html (khi có dist) → sau = 404 — không route/FE/test nào dùng path này.

## 5. Acceptance criteria (Given/When/Then)

1. GIVEN môi trường có `CI=true` (GitHub Actions) WHEN `npm test` (server) THEN 57/57 pass.
2. GIVEN **chưa có** `client/dist` WHEN GET `/images/products/khong-ton-tai.jpg` THEN status 404 và content-type KHÔNG chứa "html".
3. GIVEN máy dev có `client/dist` WHEN `npm test` THEN 57/57 pass như cũ (không hồi quy: test client-build/ảnh thật/HTML CSP vẫn xanh).
4. GIVEN đã có `client/dist` WHEN GET ảnh thật `/images/catalog/noi-chao.jpg` THEN vẫn 200 image/jpeg + cache immutable (guard không chặn ảnh thật).

## 6. Kết quả verify (đã chạy thật)

| Kịch bản | Kết quả |
|---|---|
| `npm test` (máy dev, có dist) | 57/57 pass — exit 0 |
| `CI=true npm test` (giả lập biến tự set của runner GitHub) | 57/57 pass — exit 0 (trước fix: 56/57) |
| Không `client/dist` + `CI=true` (giả lập trọn gói runner GitHub, đổi tên tạm dist) | 57/57 pass — exit 0 (trước fix: 55/57 — khớp đúng 2 test trong log GitHub) |

*Ghi chú vận hành: khi giả lập "chưa có dist" (đổi tên tạm `client/dist` ↔ `dist.off`), Windows giữ handle (Vite dev server đang watch `client/`) khiến đổi tên ngược bị "Access denied". Đã khôi phục bằng robocopy (49/49 file khớp) và dọn sạch `dist.off`.*
