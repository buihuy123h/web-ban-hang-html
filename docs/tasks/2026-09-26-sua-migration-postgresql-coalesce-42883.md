# Task: Sửa migration PostgreSQL lỗi 42883 — COALESCE/NULLIF bị viết có tiền tố schema

- **Ngày:** 2026-09-26
- **Loại:** Fix bug BE (migration data layer)
- **Phát hiện:** QA chạy thật trên PostgreSQL 16 (Docker local) — migration `001_initial_schema.sql` fail với
  `ERROR: function pg_catalog.coalesce(character varying, character varying) does not exist` (SQLSTATE **42883**).

## 1. Mục tiêu & bối cảnh

Migration chưa từng chạy được trên PostgreSQL thật: các test cũ dùng pg stub/memory model nên không bắt được.
File `001_initial_schema.sql` viết `pg_catalog.coalesce(...)` và `pg_catalog.nullif(...)` nhằm chống
`search_path` injection trong hàm `SECURITY DEFINER SET search_path = ''`. Nhưng:

- `COALESCE`, `NULLIF`, `GREATEST`, `LEAST` là **construct của parser**, không có entry trong `pg_proc`
  (đã kiểm chứng: `SELECT count(*) FROM pg_proc WHERE proname='coalesce'` → 0).
- Parser chỉ nhận dạng chúng khi gọi **không có tiền tố**; viết `pg_catalog.coalesce(...)` rơi vào lookup
  hàm thật trong catalog → luôn lỗi 42883 trên mọi PostgreSQL thật (cả local lẫn Supabase).
- Khi viết KHÔNG tiền tố, chúng vẫn **an toàn với search_path** vì không phụ thuộc catalog lookup —
  đúng ý đồ bảo mật gốc của file.

Số chỗ sai: 7× `pg_catalog.coalesce(` (dòng 122, 125, 128, 196, 206, 227, 261) + 1× `pg_catalog.nullif(`
(dòng 227) — tất cả trong `server/database/postgres/migrations/001_initial_schema.sql`.

## 2. User story

> Là chủ shop, tôi muốn `npm run db:setup` chạy thành công trên PostgreSQL thật (local Docker hoặc Supabase)
> để web bán hàng có dữ liệu thật: xem được sản phẩm và đặt được đơn.

## 3. Luật nghiệp vụ / kỹ thuật

- Giữ nguyên toàn bộ hợp đồng API, schema, tên bảng/cột/hàm — **không đổi gì ngoài cách gọi COALESCE/NULLIF**.
- Hàm thật (`btrim`, `upper`, `sum`, `lpad`, `now`…) vẫn giữ tiền tố `pg_catalog.` như cũ.
- Checksum migration sẽ đổi (file đổi nội dung). Môi trường chưa từng migrate thành công (local bị rollback;
  Supabase chưa cấu hình theo `.env`) nên không có env nào đang giữ checksum cũ. Trước khi chạy lại trên env
  đã migrate bằng bản cũ, phải đối soát `app.schema_migrations` — runner sẽ chặn nếu checksum lệch (đúng thiết kế).
- Không sửa test đang pass; chỉ **thêm** 1 test tĩnh chặn hồi quy.

## 4. Phạm vi

| File | Thay đổi |
|---|---|
| `server/database/postgres/migrations/001_initial_schema.sql` | Bỏ tiền tố `pg_catalog.` trước `coalesce(`/`nullif(` (8 chỗ) + comment chú thích luật |
| `server/test/database.test.js` | Thêm 1 test tĩnh: cấm `pg_catalog.(coalesce|nullif|greatest|least)` trong mọi file migration |
| `docs/qa/2026-09-26-sua-migration-postgresql-coalesce-42883.md` | Báo cáo QA (tạo ở giai đoạn 4) |

Không đụng: `client/**`, routes/controllers/models, `package.json`, CI/CD, `.env`.

## 5. Acceptance criteria (Given/When/Then)

- **AC1** Given PostgreSQL thật (16) chưa có schema `app`; When `npm run db:migrate`; Then cả 2 migration áp
  thành công, `app.schema_migrations` có đúng 2 dòng, không lỗi 42883.
- **AC2** When `npm run db:seed`; Then seed đúng 6 category / 21 product / 1 image / 84 spec / 2 promo (idempotent).
- **AC3** Given server chạy với `DATABASE_URL` trỏ DB đã migrate; When `GET /api/health`, `/api/categories`,
  `/api/products` (kèm tìm không dấu `?q=ghe nhua`); Then 200 và trả dữ liệu thật từ DB.
- **AC4** When `POST /api/orders` hợp lệ; Then 200, đơn được tạo qua `fn_tao_don_hang` (hàm chứa các chỗ
  `coalesce` đã sửa) — chứng minh SQL chạy được lúc runtime, không chỉ lúc migrate.
- **AC5** `npm test` pass toàn bộ (kể cả test tĩnh mới chặn construct có tiền tố schema).

## 6. Ngoài phạm vi

- Cấu hình Supabase production (chưa có project — `.env` đang dùng local).
- CI/CD workflow cũ dùng SQL Server (đã ghi nhận trong QA render — cần task CI riêng).
- CVE react-router-dom (chờ chủ repo duyệt upgrade — xem QA security 2026-09-25).
