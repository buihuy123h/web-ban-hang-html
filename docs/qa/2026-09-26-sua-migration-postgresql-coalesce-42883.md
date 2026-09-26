# QA — Sửa migration PostgreSQL lỗi 42883 (COALESCE/NULLIF có tiền tố schema)

- **Ngày:** 2026-09-26 · **Task:** `docs/tasks/2026-09-26-sua-migration-postgresql-coalesce-42883.md`
- **Kết luận:** ✅ **PASS** — AC1–AC5 đạt trên PostgreSQL 16 thật (Docker local `postgres:16-alpine`, port 5432)
- **Môi trường:** Windows + PowerShell, Node v24.11.1, PostgreSQL thật (lần đầu chạy thật — các QA trước chỉ có memory model)

## 1. Bug & nguyên nhân gốc

- **Triệu chứng:** `npm run db:migrate` fail `42883` — `function pg_catalog.coalesce(character varying, character varying) does not exist` (line 261 của `001_initial_schema.sql`).
- **Gốc rễ:** `COALESCE`/`NULLIF`/`GREATEST`/`LEAST` là construct của parser, **không có entry trong `pg_proc`** (đã kiểm chứng: `SELECT count(*) FROM pg_proc WHERE proname='coalesce'` → 0). Parser chỉ nhận dạng khi gọi **không tiền tố**; viết `pg_catalog.coalesce(...)` rơi vào lookup hàm thật → luôn lỗi 42883 trên mọi PostgreSQL thật.
- **Vì sao lọt qua test:** toàn bộ 65 test cũ dùng pg stub/memory model, chưa từng chạy SQL trên PostgreSQL thật.
- **Vì sao sửa an toàn:** viết không tiền tố thì construct **không phụ thuộc search_path** (không làm catalog lookup) → vẫn đạt ý đồ bảo mật `SET search_path = ''` của hàm `SECURITY DEFINER`. Các hàm thật (`btrim`, `sum`, `lpad`, `now`…) giữ nguyên tiền tố `pg_catalog.`.

## 2. Kết quả kiểm chứng

| # | Kiểm tra | Kết quả |
|---|---|---|
| 1 | `npm test` (gốc repo) | **PASS — 66/66** (65 cũ nguyên vẹn + 1 test tĩnh mới chặn hồi quy) |
| 2 | `npm run build` + precompress | PASS — Vite build ✓, 32 bản nén Brotli/Gzip |
| 3 | `npm run verify` (gate) | PASS — test + build |
| 4 | Tạo role `app_runtime` (điều kiện migration 002) | `CREATE ROLE` ✓ |
| 5 | `npm run db:migrate` với `MIGRATION_DATABASE_URL` local | `[migration] applied=001_initial_schema.sql` + `applied=002_runtime_permissions.sql` — **AC1 ✓** |
| 6 | `npm run db:seed` | `[seed] inserted=114`; DB đếm: **6 categories / 21 products / 84 specs / 2 promos** — **AC2 ✓** |
| 7 | `GET /api/health` | `ok=True, db=connected` — **AC3 ✓** |
| 8 | `GET /api/categories` | 6 categories — **AC3 ✓** |
| 9 | `GET /api/products?q=ghe nhua` (không dấu, qua `extensions.unaccent`) | 3 kết quả thật — **AC3 ✓** |
| 10 | `POST /api/orders` (qua `fn_tao_don_hang`) | 201, đơn `DI13507289` subtotal=170.000, discount=17.000 (QUANGHUY10), total=183.000; **row xác nhận trong `app.orders`** — **AC4 ✓** |
| 11 | `GET /` (serve client build) | 200, có `<title>` |

## 3. File thay đổi

| File | Thay đổi |
|---|---|
| `server/database/postgres/migrations/001_initial_schema.sql` | Bỏ tiền tố `pg_catalog.` trước `coalesce(`/`nullif(` ở **8 chỗ** (7 coalesce + 1 nullif) + comment chú thích luật portable SQL |
| `server/test/database.test.js` | **Thêm** 1 test tĩnh cuối file: cấm `pg_catalog.(coalesce\|nullif\|greatest\|least)(` trong mọi file migration (test mới bắt chính comment chứa chuỗi cấm → đã chỉnh câu chữ comment; test giữ độ nghiêm) |
| `docs/tasks/2026-09-26-sua-migration-postgresql-coalesce-42883.md` | Task spec (giai đoạn 1) |
| `docs/qa/2026-09-26-sua-migration-postgresql-coalesce-42883.md` | File này |

Không đụng: `client/**`, routes/controllers/models/lib, `package.json`, CI/CD, `.env`, test cũ.

## 4. Hạn chế & ghi chú cho chủ repo

1. **Checksum migration đã đổi** (file 001 thay nội dung). Env hiện có: local Docker mới migrate lần đầu bằng bản đã sửa → không xung đột. Nếu **đã từng** migrate bản cũ lên Supabase/Render, runner sẽ chặn vì checksum lệch — phải đối soát `app.schema_migrations` và quyết định riêng (hiện `.env` chưa cấu hình Supabase nên khả năng này thấp).
2. **Cơ sở hạ tầng local đã dựng cho QA:** Docker Desktop được khởi động + container `docu-quang-huy-pg` (postgres:16-alpine, port 5432, user/pass `postgres`, DB `DoCuQuangHuy`, `--restart unless-stopped`) + role `app_runtime` (password local-only, không commit). Khớp đúng cấu hình `server/.env` hiện có.
3. Chưa chạy `npm run smoke` Playwright UI (cần context trình duyệt; API + HTML đã verify thật ở bảng trên). Chạy `run.bat smoke` khi cần smoke UI đầy đủ.
4. CVE `react-router-dom` 6.x — vẫn chờ quyết định upgrade (không thuộc task này).

## 5. Handoff

```text
[HANDOFF] tester -> chu-repo
Task: docs/tasks/2026-09-26-sua-migration-postgresql-coalesce-42883.md · Status: DONE
Artifacts: docs/qa/2026-09-26-sua-migration-postgresql-coalesce-42883.md (file này), sửa 001_initial_schema.sql (8 chỗ), thêm 1 test database.test.js
Verify: npm run verify → 66/66 test + build PASS · db:migrate 2/2 · db:seed 114 rows · API health/categories/products?q= (unaccent)/POST orders (fn_tao_don_hang) trên PostgreSQL 16 thật → PASS
Next: chủ repo chạy `run.bat dev` hoặc `run.bat start` (DB Docker đã sẵn sàng, tự khởi động cùng máy); khi lên Supabase chỉ cần thay DATABASE_URL + chạy db:migrate/db:seed theo DATABASE.md
```
