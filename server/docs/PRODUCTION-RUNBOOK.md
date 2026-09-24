# Runbook production: Docker và Render

Backend được đóng gói độc lập với frontend. Docker build context là `server/`; image chỉ phục vụ
`/api/*` và `/images/*`, không build/copy `client/dist`. Frontend Vercel gọi backend bằng URL HTTPS.
Docker install bỏ native install script của `msnodesqlv8` có trong lockfile vì adapter này chỉ phục vụ
Windows Authentication; container bắt buộc dùng `DB_AUTH_MODE=sql` qua `mssql`/`tedious` thuần JS.

## Điều kiện bắt buộc trước khi deploy

- Dùng SQL Server/Azure SQL có TCP endpoint mà Render truy cập được và hỗ trợ SQL Authentication.
  `localhost`, `.\SQLEXPRESS` và SQL Server trên PC cá nhân không phải endpoint production.
- Database đã có schema/migration và dữ liệu cần thiết theo `DATABASE.md`. Backup và restore thử trước
  khi thay đổi schema; container **không** tự migration/seed khi khởi động.
- TLS của database hợp lệ để giữ `DB_ENCRYPT=true` và `DB_TRUST_SERVER_CERTIFICATE=false`. Không hạ
  kiểm tra certificate để chữa lỗi kết nối.
- Repository đã được push lên nguồn mà Render đọc được. Secret chỉ nhập trong dashboard/secret store,
  không ghi vào `.env`, Dockerfile, image layer, log hoặc ảnh chụp.

Nếu chưa có database đáp ứng các điều kiện này, chỉ build/test image và dừng trước bước tạo service.

## Build và kiểm tra Docker local

Chạy từ thư mục `server/` (PowerShell):

```powershell
Set-Location "D:\web ban hang html\server"
docker build --target test --tag do-cu-quang-huy-api:test .
docker build --tag do-cu-quang-huy-api:local .
```

Stage `test` chạy `npm test` bằng repository trong bộ nhớ, không cần DB thật. Final image dùng Node.js
22, chạy bằng user `node` và không chứa test, docs, script database, `.env` hay frontend.

Để chạy final image, tạo file env **ngoài repo** hoặc truyền biến bằng secret store. Ví dụ lệnh dưới đây
chỉ minh hoạ tên file, không dùng credential thật trong lịch sử terminal:

```powershell
docker run --rm --name do-cu-quang-huy-api --env-file "C:\secure\do-cu-render.env" -p 3000:3000 do-cu-quang-huy-api:local
```

File env production cần tối thiểu:

```dotenv
NODE_ENV=production
DB_AUTH_MODE=sql
DB_SERVER=<sql-hostname>
DB_PORT=1433
DB_NAME=DoCuQuangHuy
DB_USER=<runtime-user>
DB_PASSWORD=<secret>
DB_TRUSTED_CONNECTION=false
DB_ENCRYPT=true
DB_TRUST_SERVER_CERTIFICATE=false
DB_DRIVER=tedious
CORS_ORIGIN=https://<frontend>.vercel.app
TRUST_PROXY=1
```

Không đặt `PORT` cứng trên Render; local có thể dùng mặc định `3000`. `DB_DRIVER` có thể bỏ trống hoặc
đặt `tedious`/`mssql`; không dùng `msnodesqlv8` với SQL Authentication trong Linux container.

Kiểm tra local sau khi app kết nối DB:

```powershell
$health = Invoke-RestMethod "http://localhost:3000/api/health"
$health
docker inspect --format '{{.Config.User}}' do-cu-quang-huy-api:local
```

Health hợp lệ phải trả HTTP 200, `ok: true`, `database: "connected"`; user trong image phải là `node`.
Khi dừng bằng `docker stop`, Node nhận SIGTERM và đóng HTTP server/pool DB theo graceful shutdown.

## Tạo Docker Web Service trên Render

1. Trong Render, chọn **New > Web Service**, kết nối repository và chọn nhánh production.
2. Chọn runtime **Docker**. Cách khuyến nghị: đặt **Root Directory** là `server`, khi đó Dockerfile Path
   là `Dockerfile` và Docker build context là `.`. Nếu không đặt Root Directory, dùng Dockerfile Path
   `server/Dockerfile` và Docker Context `server`; không trộn hai cách.
3. Không nhập Build Command/Start Command riêng; Dockerfile chạy `npm start`. Không thêm migration/seed
   vào pre-deploy/start command.
4. Đặt **Health Check Path** là `/api/health`.
5. Khai báo toàn bộ biến ở bảng dưới trong **Environment**. Dùng kiểu Secret cho password/API key.
6. Deploy image. Chỉ coi deploy thành công khi log không có lỗi cấu hình/DB và health trả đúng trạng thái.

| Biến | Giá trị production |
|---|---|
| `NODE_ENV` | `production` |
| `DB_AUTH_MODE` | `sql` |
| `DB_SERVER` | Hostname TCP của SQL Server, không kèm `https://` |
| `DB_PORT` | Thường `1433`, theo nhà cung cấp DB |
| `DB_NAME` | `DoCuQuangHuy` hoặc DB production đã migrate |
| `DB_USER` | Login runtime quyền tối thiểu |
| `DB_PASSWORD` | Secret runtime |
| `DB_TRUSTED_CONNECTION` | `false` |
| `DB_ENCRYPT` | `true` |
| `DB_TRUST_SERVER_CERTIFICATE` | `false` |
| `DB_DRIVER` | `tedious`, `mssql` hoặc bỏ trống |
| `CORS_ORIGIN` | Origin FE chính xác, ví dụ `https://shop.vercel.app` |
| `TRUST_PROXY` | `1` |

`PORT` do Render cấp. Các biến timeout/pool/rate limit và xKiro là tuỳ chọn, xem `.env.example`.
Nhiều origin CORS được phân cách bằng dấu phẩy, không có path/dấu `/` cuối và không dùng `*` ở
production. Preview URL động của Vercel không tự được phép; ưu tiên domain/alias ổn định hoặc thêm từng
origin preview cụ thể rồi redeploy backend.

## Kiểm tra sau deploy

Giả sử backend là `https://<backend>.onrender.com` và frontend là
`https://<frontend>.vercel.app`:

```powershell
$backend = "https://<backend>.onrender.com"
$frontend = "https://<frontend>.vercel.app"

Invoke-RestMethod "$backend/api/health"
Invoke-RestMethod "$backend/api/categories"
Invoke-RestMethod "$backend/api/products"

$preflightHeaders = @{
  Origin = $frontend
  "Access-Control-Request-Method" = "POST"
  "Access-Control-Request-Headers" = "content-type"
}
Invoke-WebRequest -Method Options -Uri "$backend/api/orders" -Headers $preflightHeaders
Invoke-WebRequest -Method Options -Uri "$backend/api/chat" -Headers $preflightHeaders
```

- Health phải là HTTP 200 với `ok: true` và `database: "connected"`.
- GET catalog phải trả dữ liệu; mở một URL `/images/...` lấy từ response để xác nhận ảnh trả 200.
- Preflight phải có `Access-Control-Allow-Origin` đúng `$frontend`; origin lạ không được có header này.
- Kiểm tra luồng đọc catalog/ảnh/chat fallback trên FE. Không tạo đơn thử trên production.

## Log, theo dõi và lỗi thường gặp

- Xem **Logs** và **Events** của Render; đối chiếu request bằng `X-Request-Id`. Không dán secret hoặc
  payload chứa PII vào ticket.
- App fail trước khi mở cổng: kiểm tra `DB_AUTH_MODE=sql`, hostname/port, firewall, credential và TLS.
- Health 503 hoặc startup timeout: database chưa reachable/chưa migrate; sửa hạ tầng, không chuyển sang
  fixture JSON và không bật trust certificate.
- Browser báo CORS: so sánh chính xác scheme/hostname/port của FE với `CORS_ORIGIN`, sau đó redeploy BE.
- Ảnh 404: file phải tồn tại trong `server/public/images/` và DB chỉ lưu đường dẫn `/images/...`.
- Render cold start có thể khiến request đầu chậm; đợi service healthy, không giả catalog fallback.

## Rollback trên Render

1. Ngừng đưa traffic sang bản mới nếu health/catalog thất bại.
2. Trong Events/Deploys, chọn deployment/image N-1 đã khỏe và dùng thao tác rollback/redeploy của Render.
3. Xác nhận lại `/api/health`, catalog, ảnh và CORS từ domain FE.
4. Giữ log của bản lỗi để điều tra nhưng không để nó nhận traffic.

Migration phải tương thích ngược ít nhất một bản app. Không chạy `DROP` hoặc migration ngược tự động
khi rollback app. Nếu schema không tương thích, dừng ghi và restore backup trong cửa sổ bảo trì đã duyệt.

## Quy trình production Windows hiện hữu

Phần này giữ lại cho phương án chạy backend trực tiếp bằng Windows service, không áp dụng cho Render.

### Trước khi phát hành

- Dùng Node.js 22 LTS, cài dependency bằng `npm ci --omit=dev` từ lockfile.
- Chạy service bằng Windows service account riêng, không phải Administrator; cấp quyền theo
  `database/least-privilege.sql` sau khi thay placeholder đã review.
- SQL Server chỉ mở trong private network/firewall allowlist. Đặt `DB_ENCRYPT=true`,
  `DB_TRUST_SERVER_CERTIFICATE=false`; certificate phải khớp hostname và có CA tin cậy.
- Đặt `CORS_ORIGIN` đúng origin HTTPS public, `TRUST_PROXY=1` nếu có đúng một reverse proxy. Không dùng
  `*`. Secret nằm trong secret store/biến môi trường của service, không nằm trong artifact hay log.
- Rate limit RAM chỉ bảo vệ một process. Nếu chạy nhiều instance, đặt rate limit tập trung tại reverse
  proxy/gateway; không dựa vào bucket riêng của từng Node process.

### Triển khai và kiểm tra

1. Xác minh SHA-256 artifact, backup DB và bảo đảm backup gần nhất đã từng restore thử.
2. Giải nén vào thư mục version mới; không ghi đè version đang phục vụ.
3. Chạy migration forward-only/idempotent bằng `db_migrator`, không dùng service account runtime.
4. Khởi động version mới ngoài luồng traffic; `/api/health` phải trả 200 và `database=connected`.
5. Chuyển traffic nguyên tử ở reverse proxy/service manager; kiểm tra catalog và asset theo luồng chỉ đọc.
   Không chạy smoke hiện tại trên production vì nó tạo đơn hàng.
6. Theo dõi HTTP 5xx, 429, thời gian đáp ứng và log theo `X-Request-Id`; log không chứa body/PII/secret.

### Sự cố và rollback

- Khi health hoặc kiểm tra chỉ đọc thất bại, chuyển traffic về thư mục/artifact N-1 ngay; giữ bản lỗi để
  điều tra nhưng không tiếp tục nhận traffic.
- Migration phải tương thích ngược tối thiểu một bản app. Không tự chạy script `DROP` để rollback schema.
  Nếu không tương thích, dừng ghi và restore backup trong cửa sổ bảo trì đã duyệt.
- Khi DB mất kết nối, app trả 503 và không giả nhận đơn thành công. Khi tiến trình gặp lỗi fatal, service
  manager phải restart với backoff và cảnh báo; không cấu hình restart loop vô hạn.
- Xoay vòng ngay credential nghi lộ, thu hồi login cũ và kiểm tra log theo request ID. Không đưa secret vào
  ticket, ảnh chụp hoặc log tải lên CI.
