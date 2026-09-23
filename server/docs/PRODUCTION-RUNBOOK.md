# Runbook production

## Trước khi phát hành

- Dùng Node.js 22 LTS, cài dependency bằng `npm ci --omit=dev` từ lockfile.
- Chạy service bằng Windows service account riêng, không phải Administrator; cấp quyền theo
  `database/least-privilege.sql` sau khi thay placeholder đã review.
- SQL Server chỉ mở trong private network/firewall allowlist. Đặt `DB_ENCRYPT=true`,
  `DB_TRUST_SERVER_CERTIFICATE=false`; certificate phải khớp hostname và có CA tin cậy.
- Đặt `CORS_ORIGIN` đúng origin HTTPS public, `TRUST_PROXY=1` nếu có đúng một reverse proxy. Không dùng
  `*`. Secret nằm trong secret store/biến môi trường của service, không nằm trong artifact hay log.
- Rate limit RAM chỉ bảo vệ một process. Nếu chạy nhiều instance, đặt rate limit tập trung tại reverse
  proxy/gateway; không dựa vào bucket riêng của từng Node process.

## Triển khai và kiểm tra

1. Xác minh SHA-256 artifact, backup DB và bảo đảm backup gần nhất đã từng restore thử.
2. Giải nén vào thư mục version mới; không ghi đè version đang phục vụ.
3. Chạy migration forward-only/idempotent bằng `db_migrator`, không dùng service account runtime.
4. Khởi động version mới ngoài luồng traffic; `/api/health` phải trả 200 và `database=connected`.
5. Chuyển traffic nguyên tử ở reverse proxy/service manager; kiểm tra catalog và asset theo luồng chỉ đọc.
   Không chạy smoke hiện tại trên production vì nó tạo đơn hàng.
6. Theo dõi HTTP 5xx, 429, thời gian đáp ứng và log theo `X-Request-Id`; log không chứa body/PII/secret.

## Sự cố và rollback

- Khi health hoặc kiểm tra chỉ đọc thất bại, chuyển traffic về thư mục/artifact N-1 ngay; giữ bản lỗi để
  điều tra nhưng không tiếp tục nhận traffic.
- Migration phải tương thích ngược tối thiểu một bản app. Không tự chạy script `DROP` để rollback schema.
  Nếu không tương thích, dừng ghi và restore backup trong cửa sổ bảo trì đã duyệt.
- Khi DB mất kết nối, app trả 503 và không giả nhận đơn thành công. Khi tiến trình gặp lỗi fatal, service
  manager phải restart với backoff và cảnh báo; không cấu hình restart loop vô hạn.
- Xoay vòng ngay credential nghi lộ, thu hồi login cũ và kiểm tra log theo request ID. Không đưa secret vào
  ticket, ảnh chụp hoặc log tải lên CI.
