# Database PostgreSQL/Supabase

Runtime chỉ dùng PostgreSQL qua `pg` và chỉ đọc `DATABASE_URL`. Dữ liệu nghiệp vụ nằm trong schema
backend-only `app`; không thêm schema này vào Supabase **Exposed Schemas**.

## Cấu trúc và hợp đồng

- Migration nguồn: `database/postgres/migrations/*.sql`; runner lưu version/checksum trong
  `app.schema_migrations`, giữ advisory lock và chạy từng file trong transaction.
- 7 bảng nghiệp vụ: `categories`, `products`, `product_images`, `product_specs`, `promo_codes`,
  `orders`, `order_items`. ID, đường dẫn `/images/...`, snapshot tên/giá và `timestamptz` được giữ.
- `app.fn_tao_don_hang(...)` là `SECURITY DEFINER`, `search_path=''`; validate lại toàn bộ input,
  gộp item bằng JSONB (không temp table), lock product theo ID và retry collision mã đơn tối đa 20 lần.
- Catalog gọi `extensions.unaccent(...)` với bind parameter để tìm không dấu/case-insensitive.
- Runtime role chỉ được đọc catalog/promo và execute hàm; không DDL hay DML trực tiếp đơn hàng.

## Chuẩn bị Supabase an toàn

1. Tạo project và backup trước mọi thay đổi.
2. Trong SQL Editor bằng tài khoản quản trị, tạo login riêng; thay password trực tiếp, không lưu lệnh
   có secret vào repo/log:

   ```sql
   CREATE ROLE app_runtime LOGIN PASSWORD '<nhập-trực-tiếp-trong-SQL-Editor>';
   ```

3. Copy hai URI từ nút **Connect**:
   - runtime: Session pooler `5432`, username pooler tương ứng role `app_runtime`;
   - quản trị migration: direct/session admin URL. Không dùng transaction pooler `6543` mặc định.
4. Đặt tạm trong terminal/secret store, không ghi URL quản trị vào `.env`:

   ```powershell
   $env:MIGRATION_DATABASE_URL = "postgresql://.../postgres?sslmode=require"
   npm run db:migrate
   npm run db:seed
   Remove-Item Env:MIGRATION_DATABASE_URL
   ```

`npm run db:migrate` chạy lại an toàn: migration đã áp được bỏ qua nếu checksum khớp; checksum đổi sẽ
bị chặn. Không có lệnh `DROP` trong migration. `npm run db:seed` validate fixture trước transaction,
chỉ insert khóa thiếu và không ghi đè dữ liệu sửa tay. Fixture chuẩn tạo 6 category, 21 product,
1 product image, 84 spec và 2 promo. Đơn lịch sử không được seed mặc định.

## Biến môi trường runtime

```dotenv
DATABASE_URL=postgresql://app_runtime.<project-ref>:<password>@<session-pooler>:5432/postgres?sslmode=require
```

- Đây là nguồn credential runtime duy nhất; app không đọc `MIGRATION_DATABASE_URL`, `PGHOST` hoặc `DB_*`.
- Host từ xa và production phải có `sslmode=require`, `verify-ca` hoặc `verify-full`.
- `verify-ca`/`verify-full` yêu cầu `PGSSL_CA` trỏ tới CA đã mount; `require` mã hóa nhưng không xác minh
  hostname certificate. Ưu tiên `verify-full` sau khi đã cấu hình CA từ Supabase Database Settings.
- Pool/timeout tùy chọn: `PGPOOL_MAX` (1–100), `PGPOOL_IDLE_TIMEOUT_MS` (1000–300000),
  `PG_CONNECT_TIMEOUT_MS` (1000–120000), `PG_QUERY_TIMEOUT_MS` (1000–300000).
- Thiếu/sai URL, TLS hay timeout làm startup fail trước listen; log chỉ nêu tên biến/mã lỗi.

## Ảnh, seed và vận hành

DB chỉ lưu đường dẫn `/images/...`; file nằm trong `public/images/`, versioned cùng image Docker và
cache 30 ngày. Thay ảnh bằng tên file mới. Filesystem Render là ephemeral, không dùng để upload.

Sau migration/seed staging, đối soát count/ID, orphan FK, order code, tổng tiền và duplicate item trước
cutover. App/Docker/Render không tự migrate hay seed khi start. SQL Server scripts trong
`database/` là legacy để audit/import, không được runtime gọi. Workflow GitHub hiện vẫn dùng SQL Server
và phải được xử lý bằng task CI riêng đã được chủ repo duyệt.

