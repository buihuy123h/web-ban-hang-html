# Task: Sửa CORS credentials giữa Vercel và Render

- **Ngày:** 2026-09-28
- **Nguồn yêu cầu:** Chủ repo
- **Loại:** Backend-only; sửa lỗi production khi frontend Vercel gọi API Render.
- **Luồng:** `analyst -> be-coder -> tester` (bỏ `fe-coder`: không đổi UI, API business hoặc mã `client/**`).
- **Ràng buộc:** Không thêm dependency, không đổi `package.json`, CI/CD, dữ liệu Supabase, URL deploy hay biến build Vercel; không commit/push/deploy thật.

## 1. Mục tiêu và bối cảnh

Frontend production tại `https://docuquanghuy-huy-6c9e.vercel.app` gọi API Render qua
`VITE_API_URL`. Lớp gọi API chung luôn dùng `fetch(..., { credentials: 'include' })` để dùng được
phiên quản trị bằng cookie. Backend hiện đã echo `Access-Control-Allow-Origin` đúng allowlist,
nhưng không gửi `Access-Control-Allow-Credentials: true`.

Do đó browser chặn cả preflight lẫn request `/api/products` và `/api/categories`, dù Render đang
healthy và `CORS_ORIGIN` đã đúng. Console có lỗi: *The value of the
Access-Control-Allow-Credentials header in the response is '' which must be 'true' when the
request's credentials mode is 'include'.*

Mục tiêu là cho phép **chỉ** origin Vercel có trong allowlist gọi API Render bằng credentials,
đồng thời làm cookie admin hợp lệ khi frontend và backend là hai site HTTPS khác nhau. Không thay
đổi body/status/schema nghiệp vụ của các API hiện có.

## 2. User story

1. Là khách truy cập storefront, tôi muốn trang Sản phẩm tải được categories và products từ Render
   khi website chạy trên Vercel, thay vì hiện “Không tải được sản phẩm”.
2. Là quản trị viên, tôi muốn đăng nhập và dùng phiên cookie từ frontend Vercel để thao tác API
   admin trên Render.
3. Là chủ shop, tôi muốn origin không nằm trong allowlist vẫn không thể đọc response API hay dùng
   credential, và production không bị nới thành CORS wildcard.

## 3. Luật nghiệp vụ, bảo mật và trường hợp biên

### 3.1 Allowlist CORS

- `CORS_ORIGIN` vẫn là nguồn cấu hình duy nhất. Production phải là một hoặc nhiều origin tuyệt đối
  phân tách bởi dấu phẩy, ví dụ `https://docuquanghuy-huy-6c9e.vercel.app`; không có path, query,
  hash hay dấu `/` cuối.
- Giữ nguyên validation và hỗ trợ wildcard subdomain hiện có. `CORS_ORIGIN=*` bị từ chối khi
  `NODE_ENV=production`; không được thay bằng `*` để chữa lỗi.
- Khi request có `Origin` được allow, backend echo đúng origin đó, thêm `Vary: Origin` và thêm
  `Access-Control-Allow-Credentials: true`. Giá trị phải là chuỗi chính xác `true` (chữ thường),
  không phải `*`, `True` hay rỗng.
- `Access-Control-Allow-Credentials` chỉ được gửi khi origin đã được allow và ACAO là origin cụ
  thể. Không gửi credential header cho origin lạ, request không có `Origin`, hoặc nhánh wildcard
  non-production. Theo chuẩn trình duyệt, `Access-Control-Allow-Origin: *` không được kết hợp với
  credential mode `include`.
- Header CORS phải được gắn trước mọi nhánh có thể kết thúc response, để response API thành công,
  preflight và response lỗi từ origin hợp lệ nhất quán có ACAO/ACAC. Giữ `Vary: Origin` cùng các
  giá trị `Vary` khác (như `Accept-Encoding`), không ghi đè chúng.

### 3.2 Preflight và HTTP method

- Vì `client/src/api/client.js` luôn gửi `Content-Type: application/json`, kể cả GET catalog có
  thể bị preflight khi FE và BE khác origin. `OPTIONS` từ origin hợp lệ phải trả `204`, không body,
  có ACAO, ACAC, `Access-Control-Allow-Headers` chứa `Content-Type` và `X-Request-Id`, cùng
  `Access-Control-Allow-Methods` chứa toàn bộ method API đang dùng: `GET, POST, PUT, PATCH,
  DELETE, OPTIONS`.
- Không thay đổi method/path/body/response của API. Việc bổ sung PUT/PATCH/DELETE trong header
  preflight là để các route admin hiện hữu hoạt động xuyên origin, không tạo route mới.
- Preflight origin lạ vẫn trả `204`/`Cache-Control: no-store` theo hành vi hiện có nhưng **không**
  có ACAO, ACAC hay allow-method/header. Browser vì vậy không gửi request thật.
- Request không có `Origin` (health check Render, curl, server-to-server, test nội bộ) tiếp tục
  hoạt động như hiện tại và không tự nhiên nhận header CORS.

### 3.3 Cookie phiên quản trị

- Frontend không được đọc `Set-Cookie`: cookie vẫn phải `HttpOnly`, `Path=/` và có `Max-Age` như
  TTL hiện tại; không thêm `Access-Control-Expose-Headers: Set-Cookie`.
- Với production HTTPS Vercel -> HTTPS Render, cookie admin set và clear phải dùng
  `SameSite=None; Secure`, vì hai hostname là cross-site. Nếu không, CORS đã pass nhưng browser vẫn
  không gửi lại phiên admin.
- Với local/test không chạy HTTPS, giữ hành vi tương thích hiện có `SameSite=Lax` và không bắt
  buộc `Secure`, để dev proxy/test HTTP không hỏng. Quy tắc production phải dựa trên cấu hình môi
  trường đáng tin cậy (`NODE_ENV=production`), không tin một header do client tự gửi.
- Phạm vi này không đổi tên cookie, TTL, storage session, xác thực username/password hay quyền
  admin. Không log token/cookie/secret. Request thay đổi dữ liệu admin vẫn phải đi qua JSON API và
  preflight từ origin không tin cậy bị chặn; không nới CORS để hỗ trợ website lạ.

### 3.4 Triển khai và vận hành

- Môi trường Render cần giữ `NODE_ENV=production`, `TRUST_PROXY=1` và `CORS_ORIGIN` là origin
  Vercel production đúng như trên. Nếu dùng Vercel preview, chỉ thêm origin/alias đã được chủ repo
  tin cậy; không dùng wildcard `*` production.
- Thay đổi backend chỉ có hiệu lực trên Render sau khi source đã được chủ repo deploy/redeploy.
  Không cần đổi `VITE_API_URL` hoặc redeploy Vercel chỉ để nhận header mới; tuy nhiên browser có thể
  cần hard reload sau khi backend mới sẵn sàng.
- Third-party-cookie policy hoặc extension của người dùng vẫn có thể chặn riêng cookie admin. Điều
  đó không được che giấu bằng cách bỏ `HttpOnly`, bỏ `Secure` hay mở CORS cho tất cả origin.

## 4. Hợp đồng HTTP/CORS/cookie

### 4.1 API business không đổi

| Method | Path/nhóm path | Body và response |
| --- | --- | --- |
| `GET` | `/api/health`, `/api/categories`, `/api/products`, `/api/products/:id`, `/api/posts*` | Giữ nguyên status và JSON hiện có. |
| `POST` | `/api/orders`, `/api/chat`, `/api/admin/login`, `/api/admin/logout`, `/api/admin/upload`, admin create | Giữ nguyên body, validation, status và JSON hiện có. |
| `PUT` / `PATCH` / `DELETE` | Các route `/api/admin/**` đã tồn tại | Giữ nguyên body, validation, status và JSON hiện có. |

### 4.2 Response cho origin hợp lệ (ví dụ Vercel production)

Áp dụng cho mọi `/api/*` response (kể cả lỗi JSON) có `Origin` khớp `CORS_ORIGIN`:

```http
Access-Control-Allow-Origin: https://docuquanghuy-huy-6c9e.vercel.app
Access-Control-Allow-Credentials: true
Vary: Origin[, Accept-Encoding]
```

Đối với preflight, thêm:

```http
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://docuquanghuy-huy-6c9e.vercel.app
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, X-Request-Id
Vary: Origin
```

Không cần, và không được, expose `Set-Cookie` cho JavaScript.

### 4.3 Cookie từ login/logout production

`POST /api/admin/login` giữ response JSON thành công hiện có và bổ sung/sửa thuộc tính cookie thành:

```http
Set-Cookie: qh_admin_session=<opaque>; HttpOnly; SameSite=None; Secure; Path=/; Max-Age=<TTL>
```

`POST /api/admin/logout` giữ `204` và xóa cùng cookie với thuộc tính tương thích:

```http
Set-Cookie: qh_admin_session=; HttpOnly; SameSite=None; Secure; Path=/; Max-Age=0
```

Trong môi trường non-production, dùng thuộc tính cookie local/test tương thích như mục 3.3.

## 5. Phạm vi thực hiện

### `be-coder` — chỉ `server/**`

1. Sửa `server/middleware/cors.js` để phát ACAC đúng điều kiện, đủ method preflight và giữ cơ chế
   allowlist/fail-closed hiện có.
2. Nếu cần, chỉnh thứ tự middleware trong `server/app.js` để CORS áp dụng cả response lỗi mà không
   đổi parser, rate limit, security header hoặc API contract.
3. Sửa `server/middleware/admin-auth.js` để cookie production cross-site có `SameSite=None; Secure`
   và local/test vẫn dùng được.
4. Thêm/cập nhật test hồi quy trong `server/test/**`: allowed/denied origin, GET và OPTIONS có
   credentials, đủ method admin, wildcard không có ACAC và thuộc tính cookie production/non-production.
5. Chạy `npm test` tại root hoặc `server/` theo script tương ứng; bàn giao request/response mẫu đã
   kiểm chứng. Không sửa `client/**`, database, `package.json`, CI/CD hoặc deploy thật.

### `tester`

1. Đối chiếu từng acceptance criterion bên dưới, chạy `npm run verify` từ gốc repo.
2. Khi backend được chủ repo redeploy Render, kiểm tra Network thực tế với origin Vercel: preflight
   và `GET /api/products` không còn CORS error; không in cookie/token vào report.
3. Ghi QA report trong `docs/qa/`; lỗi API/CORS/cookie định tuyến về `be-coder`.

## 6. Acceptance criteria (Given/When/Then)

1. **Given** Render có `NODE_ENV=production` và `CORS_ORIGIN` chứa origin Vercel chính xác,
   **When** Vercel gọi `GET /api/products` hoặc `GET /api/categories` với `credentials: 'include'`,
   **Then** response đọc được trong browser, có ACAO echo origin, ACAC `true` và `Vary: Origin`.
2. **Given** browser gửi OPTIONS với `Origin` allow, `Access-Control-Request-Method: GET` hoặc
   method admin `PUT`/`PATCH`/`DELETE`, **When** backend xử lý, **Then** trả `204`, ACAO, ACAC,
   header/method allow theo hợp đồng và không body.
3. **Given** origin không thuộc allowlist, **When** gọi API hoặc preflight, **Then** không có ACAO
   và ACAC; production không trả wildcard `*`.
4. **Given** request không có `Origin`, **When** Render health check/curl/test gọi API, **Then** API
   giữ status/body hiện có và không phụ thuộc CORS.
5. **Given** một response API lỗi cho origin allow (ví dụ body JSON không hợp lệ), **When** browser
   nhận response, **Then** response vẫn mang ACAO và ACAC để frontend nhận đúng status/error hiện có.
6. **Given** login admin thành công ở production qua Vercel, **When** Render trả `Set-Cookie`,
   **Then** cookie là `HttpOnly; SameSite=None; Secure; Path=/` với TTL hiện có và request admin kế
   tiếp gửi được cookie bằng `credentials: 'include'`.
7. **Given** local/test HTTP, **When** login/logout chạy trong test hoặc qua Vite proxy,
   **Then** cookie local vẫn sử dụng được, không bị buộc `Secure`, và không đổi tên/TTL/logic session.
8. **Given** code backend hoàn tất, **When** chạy `npm test`, **Then** toàn bộ test pass; **When** QA
   chạy `npm run verify`, **Then** test và build đều pass.
9. **Given** backend mới đã được chủ repo deploy lên Render, **When** mở trang Sản phẩm trên Vercel và
   hard reload, **Then** Network không còn `CORS error` cho `products`/`categories` và UI không hiện
   “Không tải được sản phẩm”.

## 7. Điều kiện bàn giao

`be-coder` chỉ bàn giao sau khi `npm test` pass và nêu rõ header/cookie đã kiểm chứng. `tester` chỉ
đánh dấu DONE sau `npm run verify` pass; bước xác nhận production chỉ thực hiện sau khi chủ repo tự
push/deploy backend, vì agent không được tự deploy.
