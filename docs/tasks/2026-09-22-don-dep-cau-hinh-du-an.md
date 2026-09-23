# Task 2026-09-22 — Dọn dẹp & chuẩn hoá cấu hình dự án sau MVC + SQL Server

## Mục tiêu & bối cảnh
Sau các đợt thay đổi lớn (chatbot RAG, tách backend MVC, dữ liệu động SQL Server), repo còn sót file legacy và tài liệu mô tả sai thực trạng. Chủ repo yêu cầu: cấu hình chuẩn/chính xác + xóa file không còn cần.

## Quyết định (đã rà tham chiếu toàn repo trước khi xóa)

### Xóa
| File | Căn cứ an toàn |
|---|---|
| `server/server.js` (shim) | Đã chuyển hết tham chiếu trước khi xóa: `ci.yml` + `deploy.ps1` → `index.js`; 4 test → `app.js` |
| `server/database/generate-seed.cjs` | Generator destructive cũ; DATABASE.md chỉ document đường `generate-safe-seed.cjs`; không code/doc active tham chiếu |
| `server/data/orders.json` | Reader duy nhất là generate-seed.cjs (bị xóa); production ghi đơn vào SQL Server |
| `client/docs/design-reference/` (6.3MB) | HTML demo bên thứ 3 giai đoạn thiết kế; `DESIGN.md` là nguồn sự thật và không tham chiếu thư mục này |
| `client/docs/audit-*.png` | Evidence đợt audit UI đã hoàn tất; không được tham chiếu |

### Giữ (đã kiểm chứng active)
`.agents/` (skills IDE) · `crew/` · toàn bộ `tools/` (11 script đều có npm script + README) · `server/lib/` · `server/data/products.json` (fixture test/seed) + `chat-knowledge.json` · phần còn lại `server/database/` (DATABASE.md document) · `docs/tasks|qa` (audit trail) · `server/.env` (local, gitignored).

### Cập nhật cho chính xác
- Test: `require('../server.js')` → `require('../app.js')` (4 file, không đổi assertion)
- CI `node server/server.js` → `node server/index.js`; `deploy.ps1` `server.js` → `index.js`
- README.md, client/README.md, PRODUCT.md, AGENTS.md: mô tả đúng cấu trúc MVC, thêm `/api/chat`, 39 test (5 bộ), products.json = fixture, đơn ghi SQL Server, bỏ nhắc design-reference/audit
- `.gitignore`: thêm `release/`, `*.tar.gz` (output đóng gói deploy)
- `server/package.json`: engines `>=18` → `>=20.12` (`process.loadEnvFile`)

## Acceptance criteria
1. **Given** tham chiếu đã cập nhật, **When** xóa `server/server.js`, **Then** `npm test` 39/39 pass và `npm run verify` exit 0.
2. **Given** repo sau dọn, **When** grep `server/server.js|generate-seed|design-reference|audit-`, **Then** chỉ còn trong `docs/tasks` + `docs/qa` (bản ghi lịch sử).
3. **Given** `node server/index.js` (PORT=3100), **When** GET `/api/health`, **Then** `ok:true, database:"connected"`.
4. Tài liệu active (README, client/README, PRODUCT, AGENTS, DATABASE) không còn mô tả sai thực trạng.
