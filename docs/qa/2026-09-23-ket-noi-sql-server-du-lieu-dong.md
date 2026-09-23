# QA — Kết nối SQL Server Express và dữ liệu động

- **Ngày kiểm thử:** 2026-09-23
- **Task:** `docs/tasks/2026-09-23-ket-noi-sql-server-du-lieu-dong.md`
- **Kết quả:** PASS
- **Phạm vi:** backend/data; frontend không thay đổi trong task này

## Kết quả gate

Chạy từ thư mục gốc:

```powershell
npm.cmd run verify
```

Kết quả: **PASS** — 39/39 test Node pass, Vite production build pass và precompress pass.
Các test mặc định dùng repository bộ nhớ/mock; không kết nối SQL Server, không chạy migration và
không ghi dữ liệu thật.

## Smoke test SQL Server thật

Smoke test được chạy ngoài sandbox bằng Windows identity của chủ repo với `npm.cmd start`:

- Server chỉ mở cổng sau khi kết nối/probe SQL thành công.
- `GET /api/health` → `200`, `ok: true`, `database: "connected"`.
- `GET /api/categories` → 6 danh mục từ SQL.
- `GET /api/products?sort=price-asc` → 21 sản phẩm; giá thấp nhất 80.000đ.
- `POST /api/chat` → `200`, mode fallback, 4 product chips lấy từ catalog SQL.
- Test ghi đơn chạy trong outer transaction: Orders `5 → 6 → rollback → 5`; mã đơn thử
  `DI13653807`; `rolledBack=true`. Không để lại đơn thử.
- Migration `001-order-procedure-safe.sql` đã áp dụng bằng `CREATE OR ALTER`; Orders trước/sau
  migration vẫn `5 → 5`. Rule express 45.000đ và resultset item đã được xác nhận.
- Sau kiểm thử, server đã dừng; probe cổng `3000` trả `CLOSED`.

Không chạy script destructive `do-cu-quang-huy.sql` và không chạy seed trong QA.

## Đối chiếu acceptance criteria

| AC | Kết quả | Bằng chứng |
|---|---|---|
| 1. Windows Authentication | PASS | Kết nối thật `.\SQLEXPRESS/DoCuQuangHuy`; không cần username/password; cấu hình dùng `mssql/msnodesqlv8` và timeout hữu hạn. |
| 2. Fail-fast | PASS | Khi tiến trình QA sandbox không có Windows identity phù hợp, startup thoát code 1 trước khi listen; log chỉ có mã lỗi, không lộ connection string/stack. |
| 3. Health/readiness | PASS | SQL thật trả health 200/connected; automated test xác nhận disconnected trả 503/no-store và không lộ chi tiết. |
| 4. Catalog động | PASS | Route gọi repository ở mỗi request; automated test đổi dữ liệu fake giữa hai request không reload; smoke đọc trực tiếp 6 categories/21 products SQL. |
| 5. Contract catalog | PASS | Test API list/filter/search/sort/detail/related/404 pass; repository map DECIMAL thành number và parameter binding pass. |
| 6. Đơn bền vững | PASS | Stored procedure dùng transaction/TVP, trả summary + item snapshot; integration ghi rồi rollback xác nhận đầy đủ luồng SQL. |
| 7. Luật tiền | PASS | Automated test giá server, promo active, standard shipping và express 45.000đ pass; migration review xác nhận promo inactive bị bỏ qua và subtotal lấy từ `Products`. |
| 8. Rollback/lỗi DB | PASS | Procedure có `XACT_ABORT`, TRY/CATCH và rollback; integration outer transaction không để lại dữ liệu; route failure test trả 503/no-store, không fallback JSON. |
| 9. Chatbot | PASS | Toàn bộ chat/rate-limit regression pass; smoke SQL thật trả 4 chip sản phẩm; lỗi catalog được xử lý thành 503 chung. |
| 10. Migration an toàn | PASS | Migration chỉ tạo type nếu thiếu và `CREATE OR ALTER PROCEDURE`; không drop/delete/reseed; Orders giữ 5→5. Seed riêng dùng `IF NOT EXISTS` và transaction. |
| 11. Test độc lập | PASS | 39 test pass trong gate không cần SQL Server/ODBC/credential thật nhờ dependency injection/mock. |
| 12. Gate | PASS | `npm.cmd run verify` pass toàn bộ test và frontend production build. |

## Review an toàn và ghi chú

- Catalog bind `cat`, `q`, `id`, `excludedId`, `limit`; sort chỉ chọn từ whitelist, không nối input
  người dùng vào SQL.
- Đơn hàng bind toàn bộ scalar và items qua TVP, giá/tên/tổng tiền do SQL tính.
- Production không fallback về `products.json`/`orders.json`; JSON catalog chỉ được đọc khi test.
- App không tự chạy migration/seed lúc startup.
- Chưa có file integration test SQL opt-in tự động trong gate. Lần này luồng SQL thật được kiểm tra
  thủ công có transaction rollback; nên bổ sung harness `RUN_SQL_INTEGRATION=1` trên database test
  riêng nếu muốn lặp lại tự động trong tương lai. Đây không phải blocker cho lần bàn giao này.

## Kết luận

Triển khai đáp ứng hợp đồng API và sử dụng SQL Server làm nguồn dữ liệu runtime. Dữ liệu sửa và commit
trong SSMS được API đọc lại mà không cần sửa JSON hoặc restart server. Không phát hiện lỗi blocker/major
trong phạm vi kiểm thử.

[HANDOFF] tester -> chủ repo
Task: `docs/tasks/2026-09-23-ket-noi-sql-server-du-lieu-dong.md` · Status: DONE
Artifacts: `docs/qa/2026-09-23-ket-noi-sql-server-du-lieu-dong.md` · Verify: `npm.cmd run verify` → 39/39 test + build PASS; SQL smoke → health/categories/products/chat PASS; order transaction rollback 5→6→5 · Next: chạy `npm.cmd start`, sửa dữ liệu bằng SSMS và kiểm tra `/api/health` khi vận hành.
