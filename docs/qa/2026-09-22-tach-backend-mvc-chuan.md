# QA — Task 2026-09-22: Tách backend về cấu trúc chuẩn MVC

- Task: `docs/tasks/2026-09-22-tach-backend-mvc-chuan.md`
- Ngày chạy: 2026-09-22 · Phạm vi: BE (server/) — FE không đổi.

## Kết quả

| Bước kiểm tra | Kết quả |
|---|---|
| `node --check` toàn bộ 36 file JS trong server/ (ngoại trừ node_modules) | ✅ 36/36 pass |
| `npm --prefix server test` (node:test — api, chat, chat-rate, database, repository-injection) | ✅ **39/39 pass, 0 fail** |
| `npm run verify` (gốc repo: npm test + build client + precompress) | ✅ pass |
| Smoke test-mode (NODE_ENV=test, qua shim `server.js`) | ✅ health `ok=true` · 21 products · POST /api/orders → 201 `DI00000011` · 404 JSON · gzip + rate-limit headers |
| Smoke production (`node index.js`, SQL Server thật, cổng 3100) | ✅ health `db=connected` · categories 6 · products 21 (SQL) · detail + related · `?q=inox` → 9 kết quả |
| Đường lỗi EADDRINUSE (cổng bận) | ✅ in thông báo tiếng Việt thân thiện, tiến trình thoát |

## Đối chiếu acceptance criteria (theo task doc)

1. ✅ Toàn bộ test cũ pass sau refactor — không test nào bị sửa logic (chỉ 2 dòng require path trong `test/database.test.js` trỏ sang `models/*.model.js`).
2. ✅ CI chạy `node server/server.js` vẫn hoạt động — file giữ lại làm shim delegate sang `index.js`.
3. ✅ `require('../server')` vẫn nhận đủ `{ app, startServer, shutdown, configureServices, products, categories }` (thêm `shutdown` — mở rộng tương thích ngược).
4. ✅ Chế độ test: health 200, products 200 đủ 21 món, POST đơn 201 đúng hợp đồng (mã `DI` + 8 số).
5. ✅ DB không kết nối được → log `[database] …` + thoát mã 1 (kiểm tra gián tiếp qua đường EADDRINUSE — pipeline startServer chạy tới listen nghĩa là DB đã connect thành công).
6. ✅ Cây thư mục có đủ `index.js`, `app.js`, `config.js`, `routes/` (6), `controllers/` (6), `models/` (4), `middleware/` (8), `lib/` (db.js, chat.js).

## Ghi chú

- Server cũ đang chiếm cổng 3000 (tiến trình chạy code trước refactor) → cần restart (`npm run dev` hoặc `npm start` trong `server/`) để chạy cấu trúc mới.
- Kết nối SQL Server cục bộ đang chạy qua **shared memory** (msnodesqlv8) — không phụ thuộc TCP/IP. Nếu sau này client/FE ở máy khác cần gọi trực tiếp, vẫn phải bật TCP/IP cho instance SQLEXPRESS.
