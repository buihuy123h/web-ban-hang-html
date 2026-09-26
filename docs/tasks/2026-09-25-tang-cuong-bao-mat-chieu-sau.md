# Task — Tăng cường bảo mật chiều sâu (defense-in-depth) cho web

- **Ngày:** 2026-09-25
- **Loại:** Code — thuần BE (không đổi UI, không đổi API contract)
- **Nguồn yêu cầu:** Chủ repo — "cải thiện bảo mật cho trang web"

## 1. Mục tiêu & bối cảnh

Nâng cấp hàng rào bảo mật chiều sâu của backend Express mà **không đổi hợp đồng API, không thêm
dependency, không đổi hành vi UI**. Kiểm toán hiện trạng (2026-09-25) cho thấy nền đã chắc:
SQL 100% placeholder ($1…$8, không nối chuỗi), chặn path traversal khi serve client build,
CORS whitelist chặt (production same-origin, cấm `*`), rate limit 3 tầng (`/api` 240/phút/IP,
orders 10/phút, chat 12/phút) kèm `Retry-After`, body JSON giới hạn 100KB → 413,
`X-Request-Id` được sanitize (chống log injection), không XSS (React escape mặc định, không
dùng `dangerouslySetInnerHTML`), `npm audit` server = 0 lỗ hổng, `.env` đã gitignore,
HSTS chỉ phát sau proxy HTTPS tin cậy, slowloris timeout, graceful shutdown.

Còn 5 khoảng trống đề xuất vá trong phiên này (chi tiết mục 4).

## 2. User story

Là **chủ cửa hàng**, tôi muốn website chặn được các vector tấn công phổ biến (chèn ảnh/script
từ nguồn lạ, lạm dụng API trình duyệt, request xuyên site) để khách hàng yên tâm mua hàng
và dữ liệu đơn hàng không bị khai thác.

## 3. Luật nghiệp vụ & biên

1. **Không đổi hợp đồng API**: mọi path/field/response hiện có giữ nguyên — FE không cần sửa.
2. CSP chỉ được phép nguồn web thực sự dùng: ảnh `/images/*` + icon `data:`; font Google
   (đã khai báo); iframe Google Maps (đã khai báo `frame-src`); API cùng origin.
   Đã kiểm chứng 2026-09-25: không có ảnh ngoài (`https?://`) nào trong fixture/seed/DB —
   DB chỉ lưu đường dẫn tương đối `/images/...`.
3. Header bảo mật phát cho **mọi** response (kể cả lỗi), không phân biệt route.
4. Lỗi bất kỳ không được phép trả HTTP status ngoài khoảng 400–599 (status lạ/kiểu sai → 500).
5. Môi trường test (`npm test`) không gọi mạng ngoài, không đụng PostgreSQL (memory model).

## 4. Thay đổi đề xuất (5 mục)

| # | Vị trí | Thay đổi | Lý do |
|---|---|---|---|
| 1 | `server/middleware/security-headers.js` | CSP: `img-src 'self' data: https:` → `img-src 'self' data:` | Least privilege — web không dùng ảnh ngoài |
| 2 | `server/middleware/security-headers.js` | CSP: thêm `connect-src 'self'` | Rõ ràng hóa nguồn API hợp lệ (không phụ thuộc fallback của default-src) |
| 3 | `server/middleware/security-headers.js` | Thêm `Cross-Origin-Resource-Policy: same-origin` | Chặn site khác nhúng ảnh/resource (chống hotlink + rò rỉ cross-origin) |
| 4 | `server/middleware/security-headers.js` | Mở rộng `Permissions-Policy`: thêm `payment, usb, bluetooth, serial, idle-detection, display-capture, accelerometer, gyroscope, magnetometer` (đều `=()`) | Tắt API trình duyệt nhạy cảm web không dùng |
| 5 | `server/middleware/error-handler.js` | Whitelist `err.status`: chỉ integer 400–599, còn lại → 500 | Chống status lạ (chuỗi, 3xx, >599) từ lỗi ngoài ý muốn làm sai chuẩn HTTP |


**Ngoài phạm vi phiên này (báo cáo chủ repo):**
- `react-router-dom` 6.x (client) đang dính **2 CVE mức moderate** (GHSA-wrjc-x8rr-h8h6 —
  open redirect qua backslash trong `<Link>`/`useNavigate`; GHSA-337j-9hxr-rhxg — constructor
  injection qua `deserializeErrors()` khi SSR hydration). Bản vá = upgrade `react-router-dom`
  7.18.4 — **breaking change**, cần chủ repo duyệt riêng (task FE riêng).
- HSTS `preload`: chỉ nên thêm khi chủ repo quyết định đăng ký domain tại hstspreload.org
  (ràng buộc lâu dài, khó rollback) — để nguyên `max-age=31536000; includeSubDomains`.
- `/api/health` đang trả `version` + `uptime`: không nhạy cảm (không phải version framework),
  giữ nguyên để không phá hợp đồng.

## 5. Phạm vi file

- **Sửa:** `server/middleware/security-headers.js`, `server/middleware/error-handler.js`,
  `server/test/security-hardening.test.js` (chỉ **thêm** test mới, không đổi test đang pass),
  `README.md` (cập nhật mô tả middleware 1 dòng).
- **Thêm:** file task này, `docs/qa/2026-09-25-tang-cuong-bao-mat-chieu-sau.md` (sau verify).
- **Không sửa:** `client/**`, `server/routes/**`, `server/controllers/**`, `server/models/**`,
  `server/lib/**`, `package.json` (cả 2), CI/CD, `.env*`.

## 6. Acceptance criteria (Given/When/Then)

1. **AC1 — CSP siết nguồn ảnh:** Given server đang chạy, When client GET `/api/health`,
   Then header `Content-Security-Policy` chứa `img-src 'self' data:` và **không** chứa
   `https:` trong directive `img-src`.
2. **AC2 — CSP connect-src:** Then CSP chứa `connect-src 'self'`.
3. **AC3 — CORP:** Then mọi response có `Cross-Origin-Resource-Policy: same-origin`.
4. **AC4 — Permissions-Policy mở rộng:** Then `Permissions-Policy` chứa `camera=()`,
   `microphone=()`, `geolocation=()`, `payment=()`, `usb=()`, `bluetooth=()`, `serial=()`,
   `idle-detection=()`.
5. **AC5 — Error status whitelist:** Given route ném error có `status` ngoài 400–599
   (chuỗi, 200, 999), When lỗi đi qua error handler, Then response là **500** JSON
   `{error}` (không lộ stack/chi tiết); status hợp lệ (vd 409) vẫn giữ nguyên.
6. **AC6 — Không regression:** `npm test` pass toàn bộ (61 test cũ + test mới);
   `npm run build` exit 0; các test security đang pass giữ nguyên (không bị sửa).
7. **AC7 — UI không vỡ:** ảnh `/images/*`, font Google, iframe Google Maps vẫn tải bình
   thường (không dính CSP block) — kiểm qua test/build; smoke UI chỉ chạy khi có server
   + DB phù hợp (không tạo đơn trên production).

## 7. Phân vai theo quy trình 4 giai đoạn

- **[1] analyst:** file này.
- **[2] be-coder:** thực hiện 5 mục ở mục 4, đúng 100% AC1–AC5; `npm test` pass mới bàn giao.
- **[3] fe-coder:** **bỏ qua** (task thuần BE, không đổi API/UI) — ghi rõ trong handoff.
- **[4] tester:** đối chiếu từng AC1–AC7; test vào `server/test/security-hardening.test.js`;
  PASS → ghi `docs/qa/2026-09-25-tang-cuong-bao-mat-chieu-sau.md`; FAIL → bug report.

## 8. Bàn giao

```text
[HANDOFF] analyst -> be-coder
Task: docs/tasks/2026-09-25-tang-cuong-bao-mat-chieu-sau.md · Status: DONE
Artifacts: file task này · Verify: không áp dụng (giai đoạn phân tích)
Next: be-coder thực hiện mục 4 + test theo AC, sau đó tester verify AC1–AC7
```
