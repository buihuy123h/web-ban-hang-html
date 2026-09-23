# SQL Server và ảnh sản phẩm

Backend dùng SQL Server `DoCuQuangHuy` làm nguồn dữ liệu runtime duy nhất cho danh mục, sản phẩm,
mã giảm giá và đơn hàng. `data/products.json` chỉ còn là fixture test/nguồn seed lịch sử;
`data/orders.json` không còn được ghi khi khách đặt hàng.

> Runtime dùng `mssql@12`/`tedious@20` cần **Node.js 22 trở lên** cho SQL Authentication. Job CI
> production-like phải dùng Node 22; không hạ cảnh báo engine hoặc bỏ qua lỗi cài dependency.

## Chuẩn bị lần đầu

1. Cài SQL Server Express, SSMS và Microsoft ODBC Driver for SQL Server.
2. Backup database trước khi chạy bất kỳ script nào.
3. Nếu đây là database dev hoàn toàn trống, có thể chủ động chạy
   `database/do-cu-quang-huy.sql`. Đây là script dựng lại dữ liệu và có lệnh `DROP`, tuyệt đối
   không chạy trên database đang vận hành.
4. Với database đã có dữ liệu, chạy `database/migrations/001-order-procedure-safe.sql` trong
   SSMS. Migration dùng `CREATE OR ALTER PROCEDURE`, không xóa bảng hay dữ liệu.
5. Nếu cần nạp các dòng catalog còn thiếu, chạy `node database/generate-safe-seed.cjs`, review
   `database/seed-catalog-safe.sql`, rồi chạy file đó trong SSMS. Seed chỉ INSERT khóa còn thiếu,
   chạy lại không nhân bản và không ghi đè dữ liệu đã sửa.
6. Copy `.env.example` thành `.env`, rồi chạy `npm start`.

Ví dụ cấu hình Windows Authentication:

```dotenv
DB_AUTH_MODE=windows
DB_SERVER=.\SQLEXPRESS
# DB_PORT=1433
DB_NAME=DoCuQuangHuy
DB_DRIVER=msnodesqlv8
DB_ODBC_DRIVER=ODBC Driver 18 for SQL Server
DB_TRUSTED_CONNECTION=true
DB_ENCRYPT=true
DB_TRUST_SERVER_CERTIFICATE=true
DB_CONNECT_TIMEOUT_MS=10000
DB_REQUEST_TIMEOUT_MS=15000
DB_POOL_MAX=10
DB_POOL_MIN=0
DB_POOL_IDLE_TIMEOUT_MS=30000
```

Production phải đặt `DB_ENCRYPT=true` và `DB_TRUST_SERVER_CERTIFICATE=false`, đồng thời cài certificate
có hostname/SAN khớp `DB_SERVER` và chuỗi CA được máy Node tin cậy. `true` chỉ dành cho local hoặc
container CI tự ký khi đồng thời có `CI=true`, `DB_AUTH_MODE=sql` và `DB_ALLOW_SELF_SIGNED_CI=true`.

Ví dụ SQL Authentication cho container CI (không dùng cho production Windows):

```dotenv
CI=true
NODE_ENV=production
DB_AUTH_MODE=sql
DB_SERVER=localhost
DB_PORT=1433
DB_NAME=DoCuQuangHuy
DB_USER=app_runtime_ci
DB_PASSWORD=<GitHub secret>
DB_TRUSTED_CONNECTION=false
DB_ENCRYPT=true
DB_TRUST_SERVER_CERTIFICATE=true
DB_ALLOW_SELF_SIGNED_CI=true
```

Chạy `node database/bootstrap-ci.js` bằng `CI_SQL_ADMIN_PASSWORD` để dựng DB tạm và tạo runtime user.
Script từ chối chạy ngoài CI/host allowlist, không in secret và không dùng runtime user `sa`. Nó chạy
schema destructive chỉ trên container tạm; tuyệt đối không dùng với production/staging. Production tạo
Windows user/service account riêng rồi review `database/least-privilege.sql`: runtime chỉ đọc catalog và
`EXECUTE dbo.usp_TaoDonHang`, không có `db_owner`/DDL hoặc quyền ghi trực tiếp bảng đơn.

Tài khoản Windows chạy Node/VS Code phải được cấp quyền trên `DoCuQuangHuy`. App kết nối trực
tiếp SQL Server, không kết nối vào SSMS. App probe database trước khi mở cổng; sai instance,
thiếu quyền hoặc thiếu ODBC driver sẽ làm startup thất bại thay vì âm thầm dùng JSON.
Nếu named-instance discovery bị chặn, bật SQL Server Browser/TCP/IP hoặc đặt `DB_SERVER=localhost`
và `DB_PORT` theo port TCP tĩnh đã cấu hình trong SQL Server Configuration Manager.

## Sửa dữ liệu động bằng SSMS

- `Categories`: danh mục và ảnh danh mục.
- `Products`: tên, giá, mô tả, ảnh chính và số liệu sản phẩm.
- `ProductImages`: gallery, thứ tự theo `SortOrder`.
- `ProductSpecs`: thông số, thứ tự theo `SortOrder`.
- `PromoCodes`: mã giảm giá và trạng thái hiệu lực.
- `Orders`, `OrderItems`: dữ liệu đơn được stored procedure ghi nguyên tử.

API query DB ở mỗi request nên thay đổi đã commit trong SSMS hiện ngay, không cần restart.
Không chỉnh trực tiếp tổng tiền đơn: stored procedure luôn lấy giá hiện tại từ `Products` và
lưu snapshot vào `OrderItems`.

## Ảnh sản phẩm

DB chỉ lưu đường dẫn tương đối bắt đầu bằng `/images/...`; file thật đặt trong
`server/public/images/`. Ví dụ:

```text
server/public/images/catalog/ban-ghe.svg
server/public/images/products/ke-inox-4-tang.jpg
```

Khi thay ảnh, thêm file với tên mới rồi cập nhật `ImageUrl`/`Url` trong SSMS. Không ghi đè tên
cũ vì `/images/*` được cache 30 ngày với `immutable`.

## Vận hành và kiểm tra

```powershell
Set-Location "D:\web ban hang html\server"
npm.cmd test
npm.cmd start
```

Mở `http://localhost:3000/api/health`; `database: "connected"` nghĩa là pool sẵn sàng. Khi DB
mất kết nối, health và route phụ thuộc DB trả `503` mà không lộ connection string.

`npm test` dùng repository trong bộ nhớ, không truy cập SQL Server. Không tự chạy migration hay
seed trong startup/test. Nếu cần seed lại, backup trước và chỉ dùng script destructive trên DB
dev trống do chủ repo chủ động xác nhận.
