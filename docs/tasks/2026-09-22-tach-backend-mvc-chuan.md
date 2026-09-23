# Task 2026-09-22 — Tách backend về cấu trúc chuẩn MVC (models / controllers / routes / index.js)

## Mục tiêu & bối cảnh

`server/server.js` hiện là một file ~540 dòng gộp mọi thứ: tạo app, middleware, route,
controller, validate đơn hàng, khởi động DB, graceful shutdown. Chủ repo yêu cầu tách theo
cấu trúc chuẩn: **file model riêng, file controller riêng, file router riêng, entry `index.js`**.

Yêu cầu cứng: **không đổi hợp đồng API**, **không đổi hành vi**, toàn bộ test hiện có phải pass
nguyên vẹn. Tầng dữ liệu SQL Server (đã làm ở task `2026-09-23-ket-noi-sql-server-du-lieu-dong.md`)
giữ nguyên logic, chỉ đổi vị trí file.

## User story

Là chủ repo, tôi muốn backend organise theo MVC chuẩn để mỗi lớp một thư mục, thêm tính năng
chỉ đụng đúng file của lớp đó, người mới đọc code hiểu ngay luồng: `index.js → app.js → routes/ →
controllers/ → models/`, middleware đứng ngang hàng — mà FE và CI không cần thay đổi gì.

## Cấu trúc đích & ánh xạ cũ → mới

| Cũ (`server.js` monolith) | Mới |
|---|---|
| Khối tạo app + middleware + error handler | `app.js` (lắp đặt express app) |
| `require.main === module`: env + DB + listen + shutdown | `index.js` (entry chuẩn) |
| — (không có) | `server.js` → **shim tương thích** 6 dòng (CI `ci.yml`, `deploy.ps1`, 4/5 file test vẫn require `../server`/`../server.js`) |
| Hằng số IS_TEST, đường dẫn, PKG | `config.js` |
| Route `/api/*` đăng ký trực tiếp | `routes/index.js` + `routes/{health,categories,products,orders,chat}.routes.js` |
| Handler từng API (inline) | `controllers/*.controller.js` + `controllers/helpers.js` (databaseUnavailable) |
| `lib/catalog-repository.js` | `models/catalog.model.js` (giữ nguyên export `createCatalogRepository`, `mapProduct`) |
| `lib/order-repository.js` | `models/order.model.js` (giữ nguyên export `createOrderRepository`) |
| `lib/memory-repositories.js` | `models/memory.model.js` (giữ nguyên export `createMemoryRepositories`) |
| `let services` + `configureServices` + fixture test | `models/index.js` (registry services: `configureServices` / `getServices` / `isReady`) |
| Middleware inline (logger, headers, CORS, gzip/ETag, rate limit, 404 API, static client, error) | `middleware/*.js` (8 file) |
| `lib/db.js`, `lib/chat.js` | **giữ nguyên vị trí** (test require `../lib/db`; chat là thư viện AI, không phải model nghiệp vụ) |

## Luật nghiệp vụ & ràng buộc giữ nguyên

1. Hợp đồng API **0 thay đổi**: `GET /api/health`, `/api/categories`, `/api/products` (+`?cat` `?q` `?sort`), `/api/products/:id`, `POST /api/orders`, `POST /api/chat` — path, query, status code, body JSON, header (rate limit, gzip/ETag, cache-control) y hệt cũ.
2. Thứ tự middleware giữ nguyên: logger → security headers → json parser → CORS → gzip/ETag JSON → rate limit `/api` → routes → 404 `/api` → `/images` static → client dist + SPA fallback → error handler cuối.
3. Production: DB SQL Server bắt buộc (connect fail → thoát mã 1, đúng như hiện tại); JSON `data/products.json` chỉ là fixture test/seed.
4. `lib/chat.js` đọc `XKIRO_*` ngay khi load → `.env` phải được nạp TRƯỚC khi require (giữ ở đầu `app.js`/`index.js`/`server.js`).
5. CI/CD, root `package.json`, FE: không đụng. `server/package.json` chỉ đổi `main` + scripts `dev`/`start` trỏ sang `index.js` (được chủ repo duyệt qua yêu cầu này).

## Phạm vi

- **Sửa:** `server/server.js` (thành shim), `server/package.json` (main/dev/start), `server/test/database.test.js` (đúng 2 dòng require path — assertion không đổi).
- **Tạo:** `index.js`, `app.js`, `config.js`, `routes/*` (6), `controllers/*` (6), `models/*` (4), `middleware/*` (8).
- **Xóa:** `lib/catalog-repository.js`, `lib/order-repository.js`, `lib/memory-repositories.js` (đã chuyển vào `models/`).
- **Không đụng:** `lib/db.js`, `lib/chat.js`, `scripts/`, `data/`, `database/`, client, CI, root package.json.
- Loại bỏ kèm khối "kiểm tra file ảnh khi khởi động" trong `server.js` — code chết: production đọc catalog từ SQL (mảng rỗng → không kiểm gì), test thì bị điều kiện `!IS_TEST` chặn cảnh báo. Phần chuẩn hoá trường `image`/`images` cho fixture (test đang phụ thuộc) được giữ trong `models/index.js`.

## Acceptance criteria

1. **Given** repo đã tách MVC, **When** chạy `npm test` (trong `server/`), **Then** toàn bộ test cũ pass với số lượng bằng trước refactor (0 test bị sửa logic).
2. **Given** CI chạy `node server/server.js`, **When** file được thực thi, **Then** server khởi động như `node index.js` (shim delegate đúng).
3. **Given** test require `require('../server')`, **When** load module, **Then** vẫn nhận đủ `{ app, startServer, configureServices, products, categories }` như cũ.
4. **Given** server chạy chế độ test (memory model), **When** gọi `/api/health`, `/api/products`, `POST /api/orders` hợp lệ, **Then** status/body đúng hợp đồng cũ (200/200/201, mã đơn `DI` + 8 số).
5. **Given** DB không kết nối được, **When** chạy `node index.js`, **Then** log `[database] …` và thoát mã 1 (giữ hành vi hiện tại).
6. **Given** cấu trúc mới, **When** đọc cây thư mục `server/`, **Then** thấy đủ `index.js`, `app.js`, `routes/`, `controllers/`, `models/`, `middleware/`, `lib/`.
