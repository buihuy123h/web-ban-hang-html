# QA: Sửa CORS credentials giữa Vercel và Render

- Ngày kiểm thử: 2026-09-28
- Task: `docs/tasks/2026-09-28-sua-cors-credentials-production.md`
- Phạm vi: backend CORS, preflight, cookie phiên quản trị và hồi quy toàn hệ thống
- Kết luận local/release gate: **PASS**
- Xác nhận production sau redeploy Render: **CHỜ CHỦ REPO TRIỂN KHAI**

## Bằng chứng kiểm thử

### Test hồi quy chuyên biệt

File `server/test/cors-credentials.test.js` kiểm tra qua HTTP in-process:

1. `GET /api/products` và `/api/categories` từ origin được phép trả đúng ACAO, ACAC `true` và `Vary: Origin`; response nén vẫn giữ cả `Origin` và `Accept-Encoding` trong `Vary`.
2. Preflight cho `GET`, `POST`, `PUT`, `PATCH`, `DELETE` trả `204`, không body, đủ allow-method/header và credential headers.
3. Origin lạ ở cả API thật và preflight không nhận ACAO/ACAC; preflight không nhận allow-method/header.
4. Request không có `Origin` vẫn gọi health check bình thường và không nhận header CORS.
5. JSON hỏng trả `400` nhưng origin hợp lệ vẫn nhận ACAO/ACAC.
6. Wildcard non-production trả ACAO `*` nhưng không trả ACAC.
7. Luồng production thực tế `login -> /api/admin/me -> logout` dùng được cookie; cookie set/clear có `HttpOnly; SameSite=None; Secure; Path=/` và đúng `Max-Age`.
8. Cookie local/test vẫn dùng `SameSite=Lax`, không bị ép `Secure`, giữ nguyên tên và TTL.

Kết quả riêng: `node --test server/test/cors-credentials.test.js` → **7/7 pass**.

### Gate bắt buộc

Chạy từ gốc repo:

```text
npm.cmd run verify
```

Kết quả:

- Backend: **81/81 test pass**, 0 fail, 0 skipped.
- Frontend: Vite build thành công, 81 modules transformed.
- Precompress: tạo 40 bản Brotli/Gzip thành công.
- Tổng thể: exit code `0`.

Không chạy `npm run smoke`: task backend-only, không đổi UI; hơn nữa smoke local không thay thế được kiểm tra CORS giữa hai origin production.

## Đối chiếu acceptance criteria

| AC | Kết quả | Bằng chứng |
| --- | --- | --- |
| 1 | PASS local | GET products/categories echo origin, ACAC `true`, `Vary: Origin`; giữ `Accept-Encoding`. |
| 2 | PASS local | OPTIONS đủ 5 method API, `204`, không body, đủ header theo hợp đồng. |
| 3 | PASS local | API và OPTIONS từ origin lạ không có ACAO/ACAC; wildcard không ghép credential. |
| 4 | PASS local | Health check không `Origin` vẫn `200`, không có header CORS. |
| 5 | PASS local | JSON sai trả `400` kèm ACAO/ACAC cho origin hợp lệ. |
| 6 | PASS local | Login production set cookie cross-site; `/api/admin/me` nhận lại phiên; logout clear cookie cùng thuộc tính bảo mật. |
| 7 | PASS local | Cookie test/local là `SameSite=Lax`, không `Secure`, tên và TTL không đổi. |
| 8 | PASS | `npm.cmd run verify` pass toàn bộ test và build. |
| 9 | Chờ production | Chỉ kiểm tra sau khi chủ repo push/redeploy backend Render; agent không tự deploy. |

## Kiểm tra sau khi chủ repo redeploy Render

1. Giữ `NODE_ENV=production`, `TRUST_PROXY=1`, và `CORS_ORIGIN=https://docuquanghuy-huy-6c9e.vercel.app` trên Render.
2. Hard reload trang Sản phẩm trên Vercel.
3. Trong Network, xác nhận OPTIONS và GET `products`/`categories` không còn CORS error; response có ACAO đúng origin và ACAC `true`.
4. Xác nhận UI không còn thông báo “Không tải được sản phẩm”.
5. Nếu kiểm tra admin, chỉ xác nhận cookie hoạt động; không ghi token/cookie vào log hoặc ảnh bằng chứng.

