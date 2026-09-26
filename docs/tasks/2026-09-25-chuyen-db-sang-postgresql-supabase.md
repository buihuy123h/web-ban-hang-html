# Task 2026-09-25: Chuyển DB backend sang PostgreSQL (Supabase)

- **Loại:** thay đổi hạ tầng, thuần BE (không đổi API, không đụng FE) → quy trình rút gọn: [1] ANALYZE → [2] BACKEND → [4] QA. Bỏ [3] FRONTEND (không có thay đổi UI/API contract).
- **Người yêu cầu:** chủ repo — chuyển dự án qua PostgreSQL để dùng Supabase.
- **Trạng thái:** ✅ hoàn tất code + docs; `npm test` 61/61, `npm run verify` PASS — AC2–AC5/AC7 chờ DB thật (xem mục 8).

## 1. Mục tiêu & bối cảnh

Backend hiện chạy SQL Server qua `mssql`/`msnodesqlv8` (Windows Authentication, ODBC driver,
TVP `OrderItemType` + stored procedure `usp_TaoDonHang`). Chủ repo muốn **chuyển sang PostgreSQL
để host trên Supabase**, giữ nguyên 100% hợp đồng REST API (controller/routes không đổi) và toàn bộ
luật nghiệp vụ đặt hàng.

## 2. User story

> Là chủ cửa hàng, tôi muốn database chạy trên Supabase (PostgreSQL) để không phải tự vận hành
> SQL Server trên máy Windows, mà toàn bộ API và hành vi đặt hàng giữ nguyên như cũ.

## 3. Quyết định kỹ thuật (mapping SQL Server → PostgreSQL)

| SQL Server (cũ) | PostgreSQL/Supabase (mới) |
|---|---|
| `mssql` / `mssql/msnodesqlv8` (cần ODBC, chỉ chạy tốt trên Windows) | `pg` (node-postgres, thuần JS — chạy mọi nơi) |
| `ConnectionPool` + `pool.request().query()` | `pg.Pool` + `pool.query(text, values)` |
| TVP `OrderItemType` | tham số thứ 8 dạng **jsonb**: `[{"id":1,"qty":2}]` |
| stored proc `usp_TaoDonHang` (2 recordset) | hàm `public.fn_tao_don_hang` (1 dòng: tổng hợp + cột `items` jsonb) |
| Bảng/cột PascalCase | snake_case; query alias về `"ProductId"`… → **mapProduct & API shape không đổi** |
| `FOR JSON PATH` / `OPENJSON` | `json_agg` / `jsonb_array_elements` |
| `IDENTITY(1,1)` | `bigserial` |
| `BIT` | `boolean` |
| `DATETIME2` + `SYSUTCDATETIME()` | `timestamptz` + `now()` (model vẫn trả ISO UTC như cũ) |
| Cột computed `PERSISTED` (Total, LineTotal) | `GENERATED ALWAYS AS … STORED` |
| Collation CI_AI (tìm không dấu) | extension `unaccent` + `ILIKE` |
| TLS qua `DB_ENCRYPT`/`DB_TRUST_SERVER_CERTIFICATE` | `PGSSL` (auto/true/false) + `PGSSL_REJECT_UNAUTHORIZED` + `PGSSL_CA` |

**Biến môi trường mới** (thay toàn bộ `DB_*` cũ): `DATABASE_URL` (ưu tiên — dán connection string
Supabase) hoặc `PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD`; tuỳ chọn `PGSSL`,
`PGSSL_REJECT_UNAUTHORIZED`, `PGSSL_CA`, `PGPOOL_MAX`, `PGPOOL_IDLE_TIMEOUT_MS`,
`PG_CONNECT_TIMEOUT_MS`, `PG_QUERY_TIMEOUT_MS`.

Tinh thần **fail-closed giữ nguyên**: sai biến → khởi động thoát code 1, log *tên biến* (không lộ
mật khẩu/connection string); production bắt buộc SSL (Supabase yêu cầu TLS); host từ xa bắt buộc mật khẩu.

## 4. Hợp đồng API — KHÔNG ĐỔI

| Endpoint | Hành vi |
|---|---|
| `GET /api/health` | `{"ok":true,...,"database":"connected"}` khi pool sẵn sàng; 503 khi mất DB |
| `GET /api/categories` | `[{key,label,image}]` |
| `GET /api/products?cat&q&sort` | danh sách product theo shape `mapProduct` cũ (lọc/tìm/sắp xếp như cũ) |
| `GET /api/products/:id` | `{product, related}` |
| `POST /api/orders` | tạo đơn — response `{code,items,delivery,payment,promoCode,subtotal,shippingFee,discount,total,customer,createdAt}`; lỗi nghiệp vụ → 400 + message tiếng Việt; lỗi DB → 503 chung |
| `POST /api/chat` | không đổi (không dính DB) |

## 5. Luật nghiệp vụ tạo đơn (giữ nguyên 100% từ `001-order-procedure-safe.sql`)

1. Giỏ hàng trống → 400, message `Giỏ hàng trống.`
2. `qty` mỗi món 1–99 (kiểm tra cả **sau khi gộp** dòng trùng) → `Số lượng mỗi món phải từ 1 đến 99.`
3. Tối đa 50 món khác nhau → `Tối đa 50 món mỗi đơn.`
4. Sản phẩm không tồn tại → `Có sản phẩm không tồn tại trong cửa hàng.`
5. Gộp các dòng trùng product id (cộng qty) trước khi tính tiền.
6. Giá **luôn lấy từ DB** (lock dòng sản phẩm khi tính); `order_items` lưu snapshot tên + giá lúc đặt.
7. Ship: express 45.000₫; standard 30.000₫, miễn phí khi subtotal ≥ 500.000₫.
8. Promo: so khớp `UPPER(TRIM(promoCode))` trong `promo_codes` (đang hiệu lực) → discount =
   round(subtotal × rate); mã không hợp lệ/vô hiệu → không giảm giá và **không báo lỗi**.
   Seed: `QUANGHUY10` = 10% (đang hiệu lực), `INOX10` = 10% (đã tắt).
9. Mã đơn `DI` + 8 chữ số ngẫu nhiên, thử tối đa 20 lần đến khi duy nhất → quá 20 lần:
   `Không tạo được mã đơn duy nhất.`
10. Ghi đơn + dòng đơn nằm trong 1 transaction; lỗi → rollback toàn bộ.
11. Lỗi nghiệp vụ từ hàm (SQLSTATE `P0001`) → model gắn `isBusinessError` + `status 400`;
    các lỗi khác → đi handler 503 sẵn có, không lộ chi tiết kết nối.

## 6. Phạm vi file

**Sửa:** `server/package.json` (mssql/msnodesqlv8 → pg, thêm script `db:*`), `server/lib/db.js`,
`server/models/catalog.model.js`, `server/models/order.model.js`, `server/app.js` (wiring + log),
`server/index.js` (thông báo lỗi kết nối), `server/models/index.js` (comment), `server/.env`,
`server/.env.example`, `server/test/database.test.js`, `server/Dockerfile` (comment),
`server/docs/DATABASE.md`, `server/docs/PRODUCTION-RUNBOOK.md`, `README.md`, `AGENTS.md` (mô tả stack).

**Tạo mới:** `server/database/postgres/schema.sql` (DDL + hàm + view + index),
`server/database/postgres/apply-schema.js`, `server/database/postgres/seed.js` (seed catalog từ
`data/products.json`, idempotent), `server/database/README.md` (đánh dấu file SQL Server legacy).

**Giữ nguyên:** controllers, routes, middleware, `memory.model.js`, `api.test.js` (chính là hợp đồng
API), ảnh `server/public/images/`, fixture `server/data/products.json` (vẫn là nguồn seed).

**Không đụng — cần chủ repo duyệt riêng:** `.github/workflows/ci.yml` + `deploy.yml` (job smoke vẫn
dùng mssql container + `bootstrap-ci.js` + `verify-sql-ci.js`), `server/database/bootstrap-ci.js`,
`seed-catalog-safe.sql`, `least-privilege.sql`, `generate-safe-seed.cjs` (file SQL Server legacy).
Sau migration các file này **không còn dùng được** — cập nhật ở task riêng khi được duyệt.

## 7. Acceptance criteria

- **AC1** Given chưa khai `DATABASE_URL`/`PGHOST`; When `npm start`; Then thoát code 1, log tên biến
  thiếu, không stack trace, không lộ secret.
- **AC2** Given `DATABASE_URL` Supabase hợp lệ + schema/seed đã áp; When `npm start`; Then pool kết nối
  (probe `SELECT 1`) trước khi listen, `GET /api/health` → `{"ok":true,"database":"connected"}`.
- **AC3** `GET /api/categories`, `/api/products` (+ `cat`/`q`/`sort`), `/api/products/:id` trả JSON
  đúng shape cũ (`mapProduct` không đổi — query PostgreSQL alias cột về PascalCase).
- **AC4** `POST /api/orders` tuân thủ đủ 11 luật ở mục 5; response shape cũ.
- **AC5** Lỗi nghiệp vụ → 400 + message tiếng Việt đúng; lỗi DB → 503 chung, không lộ chi tiết.
- **AC6** `npm test` (server) pass toàn bộ; `npm run verify` (gốc repo) pass.
- **AC7** Tìm kiếm sản phẩm không dấu vẫn ra kết quả tương đương (unaccent + ILIKE).

## 8. Kết quả QA

Chạy ngày 2026-09-25 trên máy dev Windows (chưa có PostgreSQL/Supabase thật — port 5432 đóng, Docker không chạy):

| AC | Kết quả | Bằng chứng |
|---|---|---|
| AC1 fail-fast startup | **PASS** | Unit test spawn `node index.js` với `PGSSL=maybe`: thoát code 1, log `[config] PGSSL…`, không lộ secret, không stack; + 5 test config fail-fast (URL sai, thiếu biến, host xa thiếu mật khẩu, pool sai, production tắt SSL) |
| AC2 health + pool | PASS (logic) — chờ DB thật | Unit test `createDatabase`: `SELECT 1` mới `isReady()`, lỗi pool hạ readiness, `close()` đóng pool |
| AC3 catalog endpoint | PASS (logic) — chờ DB thật | `api.test.js` (hợp đồng API) + test `mapProduct` dựng đúng shape; query PostgreSQL alias cột về PascalCase giữ nguyên |
| AC4 11 luật đặt hàng | PASS (logic) — chờ DB thật | Đủ 11 luật trong `fn_tao_don_hang` (`schema.sql`); unit test khớp lệnh gọi `$8::jsonb` + mapping response |
| AC5 lỗi 400 vs 503 | **PASS** | Test P0001 → `isBusinessError` + `status 400`; lỗi khác giữ nguyên cho error handler 503 (api.test.js có sẵn case 503/no-store không lộ chi tiết) |
| AC6 test + verify | **PASS** | `npm test` (server) → **61/61 pass** (6 bộ); `npm run verify` gốc repo → test + build FE + precompress đều pass |
| AC7 tìm không dấu | PASS (logic) — chờ DB thật | `unaccent(p.name) ILIKE unaccent($2)` + `CREATE EXTENSION unaccent` trong schema; cần DB thật thử `q=ghe nhua` |

**Còn lại cho chủ repo (cần DB thật):**

1. Tạo project Supabase → copy connection string (session pooler, cổng 5432) → dán vào `server/.env` thay dòng `DATABASE_URL`.
2. `cd server; npm run db:setup` — dựng bảng + seed (hướng dẫn đầy đủ: `server/docs/DATABASE.md` mục 3).
3. `npm start` rồi kiểm tra `/api/health`, `/api/products?q=ghe nhua`, đặt 1 đơn thử kèm promo `QUANGHUY10` (giảm 10%) và `INOX10` (đã tắt, không giảm).
4. CI smoke job (`.github/workflows/ci.yml`, `deploy.yml` + `bootstrap-ci.js` + `verify-sql-ci.js`) vẫn dùng mssql container — cập nhật ở task riêng khi chủ repo duyệt (đã đánh dấu legacy trong `server/docs/DATABASE.md` mục 8).

