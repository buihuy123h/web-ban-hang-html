# QA — Dọn dẹp & chuẩn hoá cấu hình dự án (2026-09-22)

Task: `docs/tasks/2026-09-22-don-dep-cau-hinh-du-an.md` · Kết quả: **PASS**

## Đối chiếu acceptance criteria

| # | Tiêu chí | Kết quả | Bằng chứng |
|---|---|---|---|
| 1 | Xóa `server/server.js` sau khi chuyển hết tham chiếu → test + verify vẫn pass | ✅ | `npm --prefix server test` → **39/39 pass**; `npm run verify` (cmd.exe, log `%TEMP%\verify-dondep.log`) → **exit 0** |
| 2 | Grep tham chiếu chết (`server/server.js` · `generate-seed.cjs` · `design-reference` · `audit-*` · "21 test") | ✅ | Chỉ còn trong `docs/tasks/` + `docs/qa/` (bản ghi lịch sử — giữ nguyên); toàn bộ file active sạch |
| 3 | `node server/index.js` (PORT=3100) → health ok | ✅ | `{"ok":true,"version":"1.2.0","database":"connected"}` · 6 categories · 21 products · `GET /api/products/1` OK |
| 4 | Tài liệu active không còn mô tả sai thực trạng | ✅ | README.md · client/README.md · PRODUCT.md · AGENTS.md đã cập nhật: cấu trúc MVC, `/api/chat`, 39 test (5 bộ), products.json = fixture, đơn ghi SQL Server |

## Xác nhận thay đổi cấu hình
- `.github/workflows/ci.yml:104`: `node server/index.js &` (indent 10 spaces, khớp block `run: |`)
- `server/scripts/deploy.ps1:28`: `Start-Process node -ArgumentList 'index.js'`
- 4 test file (`api`, `chat`, `chat-rate`, `repository-injection`): `require('../app.js')` — assertion không đổi
- `server/package.json`: engines `>=20.12` (JSON parse OK — `process.loadEnvFile` cần 20.12)
- `.gitignore`: thêm `release/` + `*.tar.gz` (output đóng gói deploy)

## File đã xóa (đã rà toàn bộ tham chiếu trước khi xóa)
`server/server.js` (shim) · `server/database/generate-seed.cjs` (29KB generator destructive cũ) · `server/data/orders.json` (48KB runtime còn sót) · `client/docs/design-reference/` (15 file, 6.3MB demo bên thứ 3) · `client/docs/audit-desktop.png` + `audit-mobile.png`

## Giữ lại có chủ đích (đã kiểm chứng active)
`.agents/` (skills IDE) · `crew/` · toàn bộ `tools/` (11 script đều có npm script + README) · `server/lib/` (db + chat) · `server/data/products.json` (fixture test/seed) + `chat-knowledge.json` · phần còn lại `server/database/` (DATABASE.md document: `do-cu-quang-huy.sql`, `migrations/`, `generate-safe-seed.cjs`, `seed-catalog-safe.sql`) · `docs/tasks|qa` (audit trail) · `server/.env` (local, gitignored)

## Ghi chú vận hành
- Port 3000 vẫn bị tiến trình server cũ (code pre-refactor) chiếm — cần kill rồi chạy lại `npm run dev:server` (hoặc `npm start`).
- Toàn bộ thay đổi để **unstaged** — chờ chủ repo duyệt và commit.
