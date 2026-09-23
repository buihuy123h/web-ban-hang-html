# Sẵn sàng production và tăng cường bảo mật

- **Ngày:** 2026-09-23
- **Loại:** Backend + kiểm thử tích hợp + CI/CD + tài liệu vận hành; không đổi giao diện
- **Trạng thái:** Đã phân tích, chờ triển khai
- **Quyết định kiến trúc:** production Windows dùng Windows Authentication; CI Linux dùng SQL
  Authentication tới SQL Server container tạm; release chỉ được đóng gói sau các gate bắt buộc

## 1. Mục tiêu và bối cảnh

Đưa ứng dụng từ trạng thái chạy tốt ở máy phát triển tới trạng thái có thể vận hành thật với
độ an toàn, khả năng phát hiện lỗi và khả năng khôi phục phù hợp. Không hệ thống nào có thể được
cam kết “không bao giờ lỗi”; mục tiêu đo được của task này là:

- lỗi cấu hình phải làm ứng dụng **fail fast** trước khi nhận traffic;
- CI/release kiểm tra được backend với SQL Server thật, không chỉ repository giả trong RAM;
- production không dùng tài khoản quản trị DB, không lưu bí mật trong source/artifact/log;
- kết nối production được mã hóa và xác minh chứng chỉ;
- request lỗi không làm lộ stack, connection string, mật khẩu hoặc dữ liệu khách hàng;
- bản release là artifact bất biến, có checksum, có gate và có quy trình rollback rõ ràng;
- giữ nguyên REST API/UI hiện hữu và không làm chậm gate nhanh của pull request thông thường.

### Hiện trạng đã audit

Các nền tảng tốt cần giữ nguyên: câu SQL bind tham số, tạo đơn qua stored procedure/transaction,
body JSON giới hạn 100 KB, lỗi DB trả `503` chung, security header cơ bản, API/chat rate limit,
startup probe DB, graceful shutdown, test dùng dependency injection và artifact đã nén sẵn.

Khoảng trống cần xử lý:

1. `server/lib/db.js` chỉ nhận `msnodesqlv8` + Windows Authentication nên job Ubuntu không thể
   khởi động production server với SQL Server container.
2. Smoke hiện khởi động server mà không cấp DB nên thất bại trước khi Playwright chạy.
3. CORS mặc định `*`, `TRUST_PROXY` chưa validate; header chưa có CSP/HSTS phù hợp production;
   giới hạn request ghi đơn chưa tách khỏi hạn mức GET.
4. `DB_TRUST_SERVER_CERTIFICATE=true` phù hợp local/CI tự ký nhưng không được dùng ở production.
5. Workflow release hiện chỉ đóng gói; chưa có SQL integration/smoke gate, checksum, allowlist
   artifact hoặc đích deploy cụ thể. Vì chưa biết hạ tầng đích, task này **không giả lập một cơ
   chế deploy/rollback tự động không có thật**; thay vào đó tạo artifact an toàn và runbook để
   người vận hành rollback về artifact/database backup trước.

## 2. User stories

1. Là khách mua hàng, tôi muốn website vẫn trả phản hồi an toàn khi DB/AI gặp sự cố, không nhận
   đơn giả thành công và không hiển thị thông tin kỹ thuật nhạy cảm.
2. Là chủ shop, tôi muốn mỗi bản phát hành đã được test với SQL Server thật và luồng đặt hàng
   thật trên DB tạm trước khi được đóng gói.
3. Là người vận hành, tôi muốn production dùng Windows service account tối thiểu quyền, kết nối
   TLS hợp lệ, health/readiness đáng tin cậy và dừng sạch khi nâng cấp.
4. Là người phát hành, tôi muốn biết chính xác artifact nào được triển khai, xác minh checksum,
   health-check sau triển khai và quay lại bản trước nếu bản mới lỗi.
5. Là lập trình viên, tôi muốn unit test/build trên PR vẫn nhanh và không phụ thuộc SQL Server.

## 3. Luật nghiệp vụ và an toàn bắt buộc

### 3.1 Hai chế độ xác thực database

Thêm hợp đồng cấu hình `DB_AUTH_MODE`:

| Biến | Windows production/local | SQL Authentication CI |
|---|---|---|
| `DB_AUTH_MODE` | `windows` (mặc định tương thích ngược) | `sql` |
| Adapter | `mssql/msnodesqlv8` | `mssql` mặc định (`tedious`) |
| Danh tính | Windows identity của tiến trình | `DB_USER` + `DB_PASSWORD` |
| `DB_TRUSTED_CONNECTION` | phải là `true` | không dùng/phải không phải `true` |
| `DB_ODBC_DRIVER` | mặc định `ODBC Driver 18 for SQL Server` | không dùng |

- `windows` không yêu cầu/lưu username hoặc password. Giá trị `DB_DRIVER=msnodesqlv8` cũ tiếp
  tục được chấp nhận để không phá cấu hình hiện tại.
- `sql` bắt buộc `DB_USER` và `DB_PASSWORD` khác rỗng; dùng package `mssql` đã có, **không thêm
  dependency DB mới**. Không đưa credential vào object/log lỗi được stringify.
- Giá trị auth mode khác `windows|sql`, tổ hợp biến mâu thuẫn hoặc integer/boolean sai phải làm
  startup thất bại bằng thông báo tên biến, không in giá trị bí mật.
- Cả hai mode tiếp tục dùng một connection pool, timeout hữu hạn, probe `SELECT 1`, readiness và
  shutdown hiện hữu. Không fallback sang JSON khi production DB lỗi.

### 3.2 TLS theo môi trường

- `DB_ENCRYPT=true` là bắt buộc trong CI và production.
- Container CI dùng chứng chỉ tự ký nên được phép đặt `DB_TRUST_SERVER_CERTIFICATE=true` cùng
  `DB_ALLOW_SELF_SIGNED_CI=true`; ngoại lệ này chỉ hợp lệ khi `CI=true` và
  `DB_AUTH_MODE=sql`, nếu thiếu một điều kiện thì fail fast.
- Khi `NODE_ENV=production`, `DB_TRUST_SERVER_CERTIFICATE` bắt buộc là `false`; nếu không, app
  fail fast trước `listen()`. Production phải cài certificate có hostname/SAN khớp `DB_SERVER`
  và chain được máy chạy Node tin cậy.
- SQL Server production không công khai port `1433` ra Internet; firewall chỉ cho phép máy app
  và máy quản trị/migration được duyệt. Đây là điều kiện vận hành, không hardcode trong Node.

### 3.3 Quyền tối thiểu và tách danh tính

- `db_migrator`: danh tính riêng chỉ dùng trong cửa sổ deploy, có quyền áp migration đã review;
  không được dùng để chạy app.
- `app_runtime`: Windows service account production. Chỉ được `SELECT` trên
  `Categories`, `Products`, `ProductImages`, `ProductSpecs` và `EXECUTE` trên
  `dbo.usp_TaoDonHang`; không cấp `sysadmin`, `db_owner`, `db_ddladmin`, `ALTER`, `CONTROL`,
  `TAKE OWNERSHIP` hoặc quyền ghi trực tiếp bảng đơn.
- CI tạo login/user ứng dụng riêng bằng admin chỉ trong DB tạm, rồi khởi động backend bằng user
  này; backend **không chạy bằng `sa`**. Admin credential chỉ dùng cho bootstrap/migration.
- Script cấp quyền phải idempotent, có placeholder/danh tính nhận từ biến; không chứa mật khẩu,
  SID hoặc account production thật.

### 3.4 HTTP hardening không phá giao diện

- Production CORS là fail-closed: `CORS_ORIGIN` là danh sách origin tuyệt đối ngăn bởi dấu phẩy,
  khớp chính xác scheme/host/port. Không cấu hình thì chỉ same-origin; `*` chỉ được phép ngoài
  production. Origin không hợp lệ/không được phép không nhận header CORS; preflight hợp lệ trả
  `204` và `Vary: Origin`.
- Không dùng cookie/session nên không thêm CORS credentials và không cần CSRF token. CORS không
  được coi là thay thế rate limit/validation phía server.
- `TRUST_PROXY` chỉ nhận `false/0`, số hop nguyên trong giới hạn hợp lý hoặc giá trị đã whitelist
  (`loopback`, `linklocal`, `uniquelocal`). Production sau đúng một reverse proxy dùng `1`; cấu
  hình tùy ý/sai phải fail fast để tránh giả mạo `X-Forwarded-For` và vượt rate limit.
- Giữ các header cũ; bổ sung CSP tương thích UI hiện tại: script chỉ `'self'`; style cho phép
  `'self'`, Google Fonts và `'unsafe-inline'` tạm thời vì React hiện dùng inline style; font cho
  phép `'self'` và `fonts.gstatic.com`; ảnh cho phép `'self'`, `data:`, `https:`; frame chỉ cho
  Google Maps; `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`,
  `frame-ancestors 'none'`. Không dùng `unsafe-eval`.
- Chỉ gửi HSTS khi request được xác định là HTTPS qua kết nối trực tiếp hoặc proxy đã tin cậy;
  không gửi HSTS ở HTTP local/CI. Giá trị production tối thiểu `max-age=31536000;
  includeSubDomains`; chưa thêm `preload` khi chủ tên miền chưa chủ động đăng ký.
- API lỗi/404/429/503 tiếp tục là JSON tiếng Việt, `Cache-Control: no-store` cho health, lỗi DB,
  chat và order nhạy cảm. Không đổi response thành công hiện hữu.
- Tạo request ID ngắn an toàn (hoặc nhận `X-Request-Id` chỉ khi đúng whitelist ký tự/độ dài),
  trả lại ở `X-Request-Id` và log method, path, status, duration, request ID. Không log body,
  authorization, API key, DB credential, số điện thoại/địa chỉ hoặc query chứa dữ liệu nhạy cảm.

### 3.5 Chống lạm dụng và ổn định tiến trình

- Parse/validate `RATE_LIMIT_MAX`, `CHAT_RATE_MAX` và các cửa sổ/hạn mức mới; không dùng
  `Number(x) || fallback` khiến giá trị sai âm thầm được chấp nhận.
- Giữ hạn mức API đọc hiện tại; thêm bucket chặt hơn cho `POST /api/orders` (mặc định 10 request/
  phút/IP) và giữ chat mặc định 12/phút/IP. Trả `429`, `Retry-After`, không gọi DB/provider sau
  khi đã vượt hạn mức.
- Map bucket phải được quét, có giới hạn kích thước/phòng hộ để không tăng RAM vô hạn khi nhận
  nhiều IP giả. Cơ chế RAM chỉ được tuyên bố hỗ trợ **một process**; nếu scale nhiều instance,
  runbook phải yêu cầu rate limit tập trung ở reverse proxy/gateway (không tự thêm Redis).
- Giữ JSON limit 100 KB. JSON hỏng/oversize trả `400`/`413` có message chung và không có stack.
- Bắt `SIGINT`/`SIGTERM` theo cơ chế hiện tại. `uncaughtException`/`unhandledRejection` phải log
  mã lỗi đã làm sạch, ngừng nhận request, đóng pool và thoát khác 0 sau timeout; không tiếp tục
  chạy trong trạng thái không xác định.

## 4. Hợp đồng API

Task này không đổi method/path/body/JSON thành công của:

- `GET /api/health`
- `GET /api/categories`
- `GET /api/products`
- `GET /api/products/:id`
- `POST /api/orders`
- `POST /api/chat`

`GET /api/health` vẫn là readiness:

- `200`, `ok:true`, `database:"connected"` khi pool/probe sẵn sàng;
- `503`, `ok:false`, `database:"disconnected"`, `Cache-Control: no-store` khi DB chưa sẵn sàng;
- không trả hostname DB, auth mode, username, driver, connection string hoặc exception.

Thay đổi HTTP chỉ mang tính bổ sung: header bảo mật, `X-Request-Id`, `Vary: Origin`; thêm `413`
cho payload quá giới hạn và `429` cho hạn mức ghi đơn. Frontend không phải sửa.

## 5. CI production-like với SQL Server tạm

### 5.1 Gate nhanh giữ nguyên

Push/pull request vẫn chạy song song:

1. backend `npm ci` + `npm test` bằng memory repository, không cần DB/ODBC;
2. frontend `npm ci` + build + precompress + artifact.

Không làm các job này phụ thuộc SQL Server và không đưa credential vào unit test.

### 5.2 Job smoke thủ công

Job `smoke` của `.github/workflows/ci.yml` tiếp tục chỉ chạy khi `workflow_dispatch`, nhưng phải:

1. khởi tạo SQL Server 2022 service container bằng image tag/digest cố định đã kiểm thử, có
   health check và giới hạn thời gian chờ;
2. lấy admin password từ GitHub Actions secret (ví dụ `CI_SQL_ADMIN_PASSWORD`), kiểm tra secret
   tồn tại bằng lỗi rõ ràng, không echo ra log;
3. tạo DB `DoCuQuangHuy`, chạy schema/seed trên **DB container rỗng**, rồi tạo login/user runtime
   tối thiểu quyền. Script destructive hiện có chỉ được phép ở DB CI tạm, tuyệt đối không chạy
   tự động vào server/DB bên ngoài runner;
4. khởi động `node server/index.js` với `NODE_ENV=production`, `CI=true`, `DB_AUTH_MODE=sql`,
   encryption bật, ngoại lệ self-signed chỉ cho CI, credential runtime (không phải `sa`);
5. chờ `/api/health` trả 200 trong timeout hữu hạn; nếu server chết hoặc timeout, in log đã che
   secret và fail job;
6. chạy ít nhất một integration assertion cho catalog + tạo đơn/đọc kết quả DB, sau đó chạy
   Playwright `npm run smoke`;
7. luôn dừng process backend; chỉ upload screenshot và server log đã sanitize khi thất bại.

DB/container/credential CI phải bị hủy cùng runner. Không dùng DB production/staging thật cho job
này. Test tạo đơn chỉ được chạy trên DB tạm.

### 5.3 Release gate

Khi push tag `v*`, workflow release phải chạy unit test, build, dependency audit mức `high`, và
một gate SQL integration/smoke production-like tương đương mục 5.2 trước khi đóng gói. Có thể tái
sử dụng workflow/job để tránh hai bản logic khác nhau; không được chỉ tin kết quả smoke thủ công
cũ không gắn đúng commit/tag.

Action bên thứ ba/chính chủ trong workflow phải pin full commit SHA (comment phiên bản cạnh SHA),
`permissions: contents: read`, không cấp write token nếu chỉ test/đóng gói. Secret không truyền
cho job PR từ fork.

## 6. Artifact, triển khai và rollback

### 6.1 Artifact release

- Đóng gói theo allowlist runtime, không `cp -r server` rồi xóa blacklist. Không chứa `.env`,
  test, log, screenshot, source map, fixture `products.json`, script dev/destructive hoặc
  `node_modules` của runner.
- Bao gồm server runtime cần thiết, `client-dist`, ảnh, `package.json`/lockfile, knowledge chat,
  migration an toàn cần cho bản đó và README/runbook.
- Sinh file SHA-256 cho tarball; artifact name/version lấy từ tag đã validate, không nhận path
  tùy ý. Lưu artifact theo retention hiện hữu hoặc dài hơn theo chính sách chủ repo.
- `npm ci --omit=dev` trên máy đích từ lockfile; không chạy app bằng Administrator/root.

### 6.2 Trình tự deploy được hỗ trợ trong phạm vi hiện tại

Vì repo chưa khai báo máy chủ/nền tảng deploy, `deploy.yml` dừng ở artifact deploy-ready. Tài liệu
vận hành phải chốt quy trình thủ công an toàn:

1. xác minh checksum và backup DB; kiểm thử restore backup định kỳ;
2. giải nén vào thư mục version mới, không ghi đè bản đang chạy;
3. chạy migration bằng `db_migrator`; migration forward-only, idempotent, không drop data;
4. cài production dependency, start bản mới bằng service account, probe health nội bộ;
5. chuyển traffic nguyên tử ở reverse proxy/service manager;
6. post-deploy smoke **chỉ đọc** trên production; không dùng `tools/smoke.js` hiện tại vì script
   đó tạo đơn hàng;
7. nếu lỗi, chuyển traffic về thư mục/version trước. Chỉ rollback schema khi có script riêng đã
   review; mặc định restore backup trong cửa sổ bảo trì nếu migration không tương thích ngược.

Mọi migration trong release này phải tương thích ngược tối thiểu một phiên bản app để rollback
code không làm hỏng DB. Tự động deploy/rollback chỉ được bổ sung ở task sau khi chủ repo cung cấp
đích deploy, service manager, reverse proxy, secret store và RTO/RPO.

## 7. Tối ưu hiệu năng có giới hạn và đo được

- Giữ pool một lần/process; validate `DB_POOL_MIN <= DB_POOL_MAX`; mặc định max 10, request timeout
  15 giây. Không tăng pool tùy tiện vượt giới hạn SQL Server.
- Giữ parameter binding, cấm `SELECT *`, sort whitelist, pagination/limit hữu hạn cho truy vấn có
  thể tăng dữ liệu. Không thêm cache catalog dài làm dữ liệu SSMS chậm cập nhật quá 30 giây.
- Giữ Brotli/Gzip precompress, hashed asset cache một năm, HTML no-cache và ảnh immutable 30 ngày.
- Release gate phải kiểm tra bundle/build như hiện tại; không thêm dependency hoặc framework chỉ
  để đạt task này.
- Log request chậm theo ngưỡng cấu hình được nhưng không log payload/PII. Tối ưu tiếp chỉ dựa trên
  số liệu thật; task này không tuyên bố một mức tải chưa được benchmark.

## 8. Trường hợp biên

1. SQL auth thiếu user/password, Windows auth đặt trusted=false, TLS production trust=true hoặc
   pool min lớn hơn max: startup fail trước listen, message không chứa secret.
2. Mật khẩu chứa ký tự đặc biệt: truyền bằng env/driver config, không ghép connection string.
3. SQL container chưa healthy/schema chưa xong: backend không khởi động; workflow timeout và fail,
   không chạy smoke trên fixture.
4. DB rớt sau startup: health và route DB trả 503/no-store, đơn không trả 201, không fallback JSON.
5. Origin không có header (same-origin/server-to-server): request vẫn được xử lý nhưng không tự
   thêm wildcard CORS. Origin lạ: không có ACAO; preflight bị từ chối.
6. Proxy cấu hình sai hoặc client tự gửi `X-Forwarded-For`: IP chỉ được tin khi `TRUST_PROXY` hợp
   lệ; không mở tin tất cả proxy.
7. Request ID quá dài/có ký tự điều khiển: bỏ giá trị client và tạo ID mới, tránh log injection.
8. Payload >100 KB, JSON hỏng, quá rate: dừng trước controller/DB với 413/400/429 tương ứng.
9. AI timeout/4xx: vẫn fallback như hiện tại; không log API key hoặc toàn bộ response provider.
10. Migration/app mới lỗi sau switch: code quay về artifact trước; DB migration tương thích ngược,
    hoặc restore backup theo runbook — không chạy `DROP` tự động.
11. GitHub secret thiếu: job báo tên secret cần cấu hình nhưng không in value; release bị chặn.
12. Smoke thất bại: giữ evidence đã sanitize, không đóng gói/phát hành artifact như đã đạt gate.

## 9. Phạm vi triển khai và quyền sở hữu

### Backend — `be-coder`

- `server/lib/db.js`, `server/index.js`, `server/app.js`
- `server/middleware/**` cần cho CORS/header/request ID/rate limit/error handling
- `server/database/**` cho migration/quyền tối thiểu/bootstrap CI an toàn
- `server/.env.example`, `server/docs/DATABASE.md` và tài liệu vận hành trong `server/docs/**`
- Không đổi API success, không thêm dependency; `server/package*.json` chỉ sửa nếu thật sự bắt
  buộc và phải nêu lý do (thiết kế hiện tại không cần).

### QA — `tester`

- `server/test/**`: config hai auth mode, TLS guard, CORS/proxy/header/request ID/rate limit,
  payload oversize, signal/fatal error bằng injection an toàn, không gọi DB thật trong unit test.
- `tools/scripts/**` nếu cần tách smoke CI có ghi vào DB tạm và smoke production read-only.
- `docs/qa/**`: đối chiếu toàn bộ acceptance criteria.

### CI/CD — chủ repo/người điều phối được chủ repo ủy quyền

- `.github/workflows/ci.yml`, `.github/workflows/deploy.yml` và script đóng gói dùng riêng cho
  workflow. Đây là ngoại lệ CI/CD đã được yêu cầu trong task này; `be-coder`/`tester` không tự sửa
  `.github/**` nếu chưa được người điều phối phân công đúng quyền.
- Cấu hình GitHub Environment protection/required reviewers và secret trong giao diện GitHub là
  bước vận hành của chủ repo, không thể hoàn tất chỉ bằng code.

### Không thuộc phạm vi

- Không sửa `client/**`; không đổi UI/UX, REST success contract, provider AI hoặc dữ liệu thật.
- Không tự commit/push/deploy, không chạy migration/destructive script vào SQL Server của chủ repo.
- Không mở firewall, mua/cấp TLS certificate, tạo service account production hoặc đoán hạ tầng.
- Không thêm Redis/WAF/APM/secret manager bên ngoài khi chưa được duyệt.

## 10. Acceptance criteria (Given/When/Then)

1. **Windows Auth:** Given instance production và Windows service account có quyền tối thiểu,
   When start với `DB_AUTH_MODE=windows`, Then app dùng `msnodesqlv8`, probe thành công và không
   cần username/password.
2. **SQL Auth CI:** Given SQL Server container và runtime login, When start với
   `DB_AUTH_MODE=sql`, Then app dùng adapter mặc định, kết nối/pool/query/order hoạt động mà không
   load `msnodesqlv8`.
3. **Config fail-fast:** Given auth mode/credential/timeout/pool/proxy/CORS sai, When bootstrap,
   Then không listen, exit khác 0 và log chỉ tên cấu hình/lỗi đã sanitize.
4. **TLS:** Given `NODE_ENV=production`, When encrypt=false hoặc trust certificate=true mà không
   đủ bộ cờ ngoại lệ CI, Then startup bị chặn; Given CI self-signed có `CI=true`, SQL auth,
   encrypt=true, trust=true và `DB_ALLOW_SELF_SIGNED_CI=true`, Then CI được phép kết nối.
5. **Least privilege:** Given runtime user CI chỉ có quyền theo mục 3.3, When chạy catalog và đặt
   đơn, Then đều thành công; When thử DDL/ghi trực tiếp bảng, Then SQL Server từ chối.
6. **Readiness/lỗi DB:** Given DB sẵn sàng/mất kết nối, When gọi health và route DB, Then status,
   no-store, rollback và response che thông tin đúng hợp đồng; không trả 201 nếu order chưa commit.
7. **CORS/proxy:** Given same-origin, origin allowlist, origin lạ và forwarded IP qua proxy đúng/
   sai, When gửi request/preflight, Then ACAO/Vary/client IP/rate bucket đúng mục 3.4.
8. **Security headers:** Given HTTP local và HTTPS production qua trusted proxy, When tải HTML/API,
   Then CSP/header cũ có mặt; HSTS chỉ có trên HTTPS và UI/Google Fonts/Google Maps vẫn hoạt động.
9. **Chống lạm dụng:** Given quá hạn mức order/chat hoặc payload lớn/hỏng, When request, Then
   429/413/400 + Retry-After phù hợp, controller/DB/provider không được gọi và Map được dọn/chặn lớn.
10. **Quan sát an toàn:** Given request ID hợp lệ/độc hại và lỗi DB/AI, When request kết thúc, Then
    response/log correlate được nhưng không có PII, secret, stack hoặc log injection.
11. **CI nhanh:** Given runner không có SQL Server, When chạy job backend/frontend PR, Then
    `npm test` và build pass độc lập như hiện tại.
12. **Smoke production-like:** Given workflow dispatch và secret hợp lệ, When smoke chạy, Then DB
    tạm được schema/seed, backend chạy `NODE_ENV=production` bằng SQL runtime user, health/catalog/
    order/Playwright pass; không dùng fixture runtime hoặc `sa`.
13. **Release gate:** Given tag release, When SQL integration/smoke/dependency audit có lỗi, Then
    không tạo artifact đạt chuẩn; khi pass, artifact allowlist có checksum và không chứa secret,
    test, fixture, destructive script hay source map.
14. **Rollback thực tế:** Given artifact N lỗi sau deploy, When làm theo runbook, Then traffic quay
    về artifact N-1 và DB vẫn tương thích; không tuyên bố rollback tự động khi chưa cấu hình host.
15. **Không regress:** Given triển khai hoàn tất, When chạy `npm test`, `npm run build`,
    `npm run verify` và smoke DB tạm, Then toàn bộ test cũ + mới pass, API/UI contract không đổi.

## 11. Trình tự bàn giao

1. `be-coder` triển khai phần backend/database/docs và chạy `npm test`.
2. Không có thay đổi giao diện nên bỏ giai đoạn FE.
3. Người điều phối/chủ repo triển khai workflow CI/CD theo mục 5–6 và cấu hình secret/environment
   ngoài repo; không lưu secret vào file.
4. `tester` bổ sung/đối chiếu test, chạy `npm run verify` và smoke với SQL Server container tạm.
5. Nếu chưa có `CI_SQL_ADMIN_PASSWORD`, certificate/domain/service account hoặc đích deploy, ghi
   rõ phần vận hành tương ứng là `NEEDS_INPUT`; các thiếu hụt đó không được che bằng credential giả.
