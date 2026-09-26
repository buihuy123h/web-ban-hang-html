# Task: Chuẩn hóa backend Express để deploy Render từ monorepo

- **Ngày:** 2026-09-25
- **Nguồn yêu cầu:** Chủ repo
- **Loại:** Backend/vận hành; frontend Vercel đã có
- **Luồng:** `analyst -> be-coder -> tester` (bỏ `fe-coder` vì không đổi mã nguồn/UI frontend)
- **Ràng buộc:** giữ monorepo; không đổi dependency, hợp đồng API, `package.json` gốc hay CI/CD; không commit/push/deploy thật; không đọc hoặc làm lộ secret.

## 1. Mục tiêu và bối cảnh

Chuẩn hóa cấu trúc hiện tại để backend Express trong `server/` có thể được Render build/run độc lập,
trong khi frontend tiếp tục được Vercel phục vụ từ `client/`.

Kết luận kiến trúc: **không cần tách FE và BE thành hai GitHub repository**. Repo hiện tại là monorepo hợp
lệ; Render hỗ trợ đặt Root Directory cho từng ứng dụng trong monorepo. Cấu trúc đích:

```text
GitHub monorepo
├── client/                    # React/Vite; Vercel build độc lập
│   ├── src/
│   └── vercel.json
├── server/                    # Express; Render Docker Web Service
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── package.json
│   ├── index.js -> app.js
│   ├── routes/ -> controllers/ -> models/
│   ├── lib/ + middleware/
│   ├── public/images/         # asset chỉ đọc, đóng trong image
│   ├── database/              # script quản trị; không tự chạy lúc start
│   ├── test/
│   └── docs/
├── docs/                      # task/QA, không phải runtime
└── package.json               # điều phối local/CI, không phải entrypoint Render
```

Hiện trạng đã có nền tảng tốt: `server/Dockerfile`, `server/.dockerignore`, `server/.env.example`,
`server/docs/PRODUCTION-RUNBOOK.md`, `GET /api/health`, CORS allowlist, SQL Authentication và graceful
shutdown. Task này là kiểm chứng/hardening phần còn thiếu, tránh viết lại kiến trúc đã đúng.

Theo tài liệu Render được đối chiếu ngày 2026-09-25:

- Root Directory làm cho lệnh, Dockerfile path và Docker context được tính tương đối từ thư mục đó;
  file bên ngoài không có trong build/runtime.
- Web Service phải bind cổng `$PORT` trên `0.0.0.0`; Render hiện mặc định `PORT=10000` nếu không đặt.
- HTTP health check coi `2xx/3xx` là khỏe; endpoint readiness nên kiểm tra tài nguyên trọng yếu như DB.
- Filesystem mặc định là ephemeral. Source/ảnh đóng trong image có lại sau mỗi deploy, nhưng file phát
  sinh hoặc sửa lúc runtime sẽ mất nếu không có persistent storage.
- Secret phải nhập qua Environment/secret store, không đưa vào Docker build arg, image hoặc repo.

Nguồn chính thức: [Monorepo Support](https://render.com/docs/monorepo-support),
[Docker on Render](https://render.com/docs/docker), [Web Services](https://render.com/docs/web-services),
[Health Checks](https://render.com/docs/health-checks), [Persistent Disks](https://render.com/docs/disks),
[Environment Variables and Secrets](https://render.com/docs/configure-environment-variables).

## 2. User stories

1. Là chủ shop, tôi muốn giữ một GitHub repo nhưng Vercel chỉ deploy `client/` và Render chỉ deploy
   `server/`, để quản lý đơn giản mà không đóng gói nhầm FE vào BE.
2. Là người vận hành, tôi muốn cấu hình Render bằng các giá trị rõ ràng, health check đúng và log không
   lộ bí mật để có thể tự deploy/redeploy.
3. Là khách mua hàng, tôi muốn danh mục, ảnh, chatbot và đặt hàng vẫn hoạt động khi FE/BE khác origin.
4. Là người quản trị dữ liệu, tôi muốn SQL Server tiếp tục là nguồn runtime, không bị thay bằng JSON hoặc
   tự chạy migration nguy hiểm khi container khởi động.

## 3. Luật nghiệp vụ và vận hành

### 3.1 Ranh giới deploy

- Vercel chỉ build `client/`; Render chỉ build/run `server/`.
- Cấu hình Render khuyến nghị duy nhất cho repo này:
  - Service type: **Web Service**.
  - Language/runtime: **Docker**.
  - Root Directory: `server`.
  - Dockerfile Path: `Dockerfile`.
  - Docker Context: `.`.
  - Docker Command/Start Command: để trống để dùng `CMD ["npm", "start"]`.
  - Health Check Path: `/api/health`.
- Không dùng đồng thời Root Directory `server` với đường dẫn `server/Dockerfile`/context `server`, vì
  các trường này đã được tính tương đối từ Root Directory.
- Thay đổi ngoài `server/` không nên kích hoạt deploy backend khi Root Directory đã được cấu hình.

### 3.2 Runtime HTTP

- App phải dùng `process.env.PORT` và bind rõ ràng trên `0.0.0.0`; local fallback có thể là `3000`.
- Không đặt cứng `PORT=3000` trong Render Dashboard hoặc Docker command.
- App chỉ bắt đầu lắng nghe sau khi kết nối/probe SQL Server thành công; startup lỗi DB phải fail deploy,
  không âm thầm dùng fixture.
- `SIGTERM` phải ngừng nhận request, đóng pool DB và thoát sạch để deploy/restart không làm hỏng đơn.
- `TRUST_PROXY=1` vì app đứng sau đúng một lớp proxy Render; giá trị khác chỉ dùng khi topology thực tế
  được xác nhận.

### 3.3 Database

- Runtime production tiếp tục dùng SQL Server/Azure SQL tương thích TDS qua `mssql`/`tedious`, với SQL
  Authentication. Windows Authentication, `.\\SQLEXPRESS` và `localhost` không dùng được từ Render.
- Database phải có TCP endpoint mà Render truy cập được. Nếu DB dùng firewall allowlist, lấy **toàn bộ
  outbound CIDR được hiển thị cho service/region** hoặc dùng dedicated outbound IP phù hợp; không đoán
  một IP duy nhất.
- Schema, stored procedure và dữ liệu được chuẩn bị riêng có backup theo `server/docs/DATABASE.md`.
  Container không chạy seed/migration/destructive SQL trong build, pre-deploy hay start.
- Runtime login dùng quyền tối thiểu: đọc catalog/promo và execute stored procedure tạo đơn; không dùng
  `sa`, `db_owner` hoặc tài khoản migration.
- Production giữ `DB_ENCRYPT=true`, `DB_TRUST_SERVER_CERTIFICATE=false`. Nếu nhà cung cấp chỉ có cert
  tự ký/hostname sai thì dừng và sửa hạ tầng; không bật ngoại lệ CI trên production.

### 3.4 Ảnh và filesystem

- DB chỉ lưu đường dẫn `/images/...`; file thật nằm trong `server/public/images/` và được COPY vào image.
- Ảnh hiện tại là asset versioned/chỉ đọc nên **không cần Render persistent disk**.
- Không cho phép upload/sửa ảnh runtime trong phạm vi task. Nếu sau này có upload, phải thiết kế object
  storage hoặc persistent storage riêng; ghi vào filesystem mặc định của Render sẽ mất khi restart/deploy.
- Không copy `client/dist` vào image backend. Render backend chỉ cần `/api/*` và `/images/*`.

### 3.5 CORS và frontend Vercel

- `CORS_ORIGIN` là origin HTTPS chính xác của Vercel production, chỉ gồm scheme + host (+ port nếu có),
  không có path hoặc dấu `/` cuối; production không dùng `*`.
- Có thể cấu hình nhiều origin bằng dấu phẩy khi thật sự cần. Vercel preview URL động không tự được mở;
  chỉ thêm origin cụ thể hoặc dùng alias ổn định.
- Vercel phải có `VITE_API_URL=https://<backend>.onrender.com/api`, có `/api`, không có dấu `/` cuối.
  Sau khi đổi phải redeploy FE vì đây là biến build-time.
- Ảnh `/images/...` phải được FE resolve về origin backend hiện tại; không đưa hostname Render vào source.

### 3.6 Secret và an toàn repository

- Biến bí mật chỉ nhập trong Render Environment/secret store. Không commit `.env`, password DB,
  connection string, API key, recovery code hoặc token; không in chúng trong log/screenshot/QA.
- Audit phát hiện `recovery-codes.txt` đang **untracked ở gốc repo**. Không đọc nội dung. Trước lần
  `git add`/push tiếp theo, chủ repo phải chuyển file ra ngoài repo hoặc xóa bằng cách an toàn; nếu file
  từng được commit/push/chia sẻ thì phải thu hồi/rotate mã tại nhà cung cấp. Việc di chuyển/xóa hoặc sửa
  `.gitignore` gốc nằm ngoài phạm vi `be-coder`, nên không tự thực hiện trong task này.
- Không dùng `git add .` trước khi `git status --short` xác nhận không còn file nhạy cảm ngoài ý muốn.

## 4. Hợp đồng cấu hình Render

### 4.1 Biến bắt buộc

| Biến | Giá trị/quy tắc |
|---|---|
| `NODE_ENV` | `production` |
| `DB_AUTH_MODE` | `sql` |
| `DB_SERVER` | Hostname TCP, không có protocol/path |
| `DB_PORT` | Port nhà cung cấp, thường `1433` |
| `DB_NAME` | Database production đã migrate, mặc định nghiệp vụ `DoCuQuangHuy` |
| `DB_USER` | Runtime login quyền tối thiểu |
| `DB_PASSWORD` | Secret, không ghi vào repo/log |
| `DB_TRUSTED_CONNECTION` | `false` |
| `DB_ENCRYPT` | `true` |
| `DB_TRUST_SERVER_CERTIFICATE` | `false` |
| `DB_DRIVER` | `tedious`, `mssql` hoặc bỏ trống; không dùng `msnodesqlv8` |
| `CORS_ORIGIN` | Origin Vercel production chính xác |
| `TRUST_PROXY` | `1` |

`PORT` do Render cấp, không cần khai báo. `XKIRO_API_KEY` và cấu hình model là tuỳ chọn; thiếu key thì
chatbot dùng fallback hiện hữu. Timeout/pool/rate limit dùng mặc định đã kiểm thử hoặc theo
`server/.env.example`.

### 4.2 Validation bắt buộc

- Sai/mất biến DB, boolean sai format, wildcard CORS trong production hoặc origin có path phải khiến app
  từ chối khởi động với thông báo cấu hình đã lọc, không chứa credential.
- Không thêm một biến kiểu `DATABASE_URL` nếu code hiện tại không đọc nó; mapping phải đúng các biến
  `DB_*` ở trên.
- `PORT`, timeout, pool và rate limit phải được parse/ràng buộc; không chấp nhận số âm, NaN hoặc ngoài
  phạm vi hiện hữu.

## 5. Hợp đồng API

Task không đổi request/response business API. Phải giữ nguyên:

| Method | Path | Hành vi deploy liên quan |
|---|---|---|
| `GET` | `/api/health` | DB sẵn sàng: `200`, `ok: true`, `database: "connected"`; DB mất sẵn sàng: `503`, không lộ chi tiết kết nối |
| `GET` | `/api/categories` | Đọc SQL Server; lỗi DB trả trạng thái an toàn hiện hữu |
| `GET` | `/api/products` | Giữ query/filter/schema hiện hữu |
| `GET` | `/api/products/:id` | Giữ schema/status hiện hữu |
| `POST` | `/api/orders` | Giữ validation, server-side pricing, rate limit và schema/status hiện hữu |
| `POST` | `/api/chat` | Giữ AI/fallback và rate limit hiện hữu |
| `GET` | `/images/*` | Phục vụ asset trong image; cache policy hiện hữu |

CORS/preflight:

- Origin đúng allowlist nhận `Access-Control-Allow-Origin` đúng origin.
- `OPTIONS` cho `/api/orders` và `/api/chat` trả thành công với `Content-Type`/method hiện hữu.
- Origin lạ không nhận header cho phép; không làm API thành wildcard để chữa lỗi cấu hình.

## 6. Phạm vi triển khai

### `be-coder` — chỉ `server/**`

1. Đối chiếu Dockerfile, `.dockerignore`, entrypoint, CORS, DB config và runbook với đặc tả này.
2. Nếu cần, harden việc bind `0.0.0.0:$PORT` và thêm/sửa test hồi quy tương ứng trong `server/test/**`.
3. Cập nhật `server/docs/PRODUCTION-RUNBOOK.md` để có một luồng Dashboard duy nhất (Root Directory
   `server`, Dockerfile `Dockerfile`, context `.`), bảng env, điều kiện DB/firewall, filesystem/ảnh,
   Vercel handoff, kiểm tra sau deploy và rollback.
4. Giữ Docker image Node 22, non-root, deterministic lockfile, không chứa frontend/test/docs/secret ở
   final stage. Không thêm dependency hoặc Blueprint gốc.
5. Chạy `npm test` trong `server/`. Nếu Docker engine khả dụng, build test/final image và xác nhận user;
   nếu không, ghi rõ giới hạn môi trường thay vì tuyên bố Docker pass.

Không sửa `client/**`, file gốc, GitHub Actions, database production hoặc cấu hình tài khoản Render.

### `tester`

- Đối chiếu từng acceptance criterion; chạy `npm run verify` từ root.
- Kiểm tra Docker nếu engine khả dụng; kiểm tra cấu hình tĩnh nếu không.
- Không deploy thật, không tạo đơn production, không đọc secret.
- Viết `docs/qa/2026-09-25-chuan-hoa-backend-deploy-render.md`; fail thì phát bug cho `be-coder`.

## 7. Trường hợp biên

1. **DB chỉ chạy trên PC cá nhân:** Render không thể dùng `.\\SQLEXPRESS`; kết luận `NEEDS_INPUT` về hạ
   tầng DB, không mở thẳng PC ra Internet và không fallback JSON.
2. **Firewall DB:** allowlist thiếu một outbound CIDR có thể gây lỗi kết nối không ổn định; cấu hình theo
   danh sách hiện tại trong dashboard của đúng service/region.
3. **DB chậm/cold start:** app chưa listen cho tới khi DB connect; deploy có thể chờ/fail health. Không
   trả health giả `200` chỉ để vượt gate.
4. **Free/cold service:** request đầu có thể chậm; FE giữ error/retry UX hiện hữu, không cache catalog giả.
5. **Sai Root Directory:** nếu đặt `server`, không được tiếp tục nhập `server/Dockerfile`; build path sẽ
   bị lặp và thất bại.
6. **Sai `VITE_API_URL`:** thiếu `/api` hoặc thêm `/` cuối có thể tạo URL sai; sửa env rồi redeploy FE.
7. **Vercel preview:** origin thay đổi bị chặn có chủ đích; không bật wildcard production.
8. **Ảnh mới chỉ tồn tại local:** ảnh phải được commit trong `server/public/images/` và path DB khớp;
   runtime copy thủ công vào container không bền qua deploy.
9. **Đổi ảnh cùng tên:** cache immutable 30 ngày; phải dùng tên file mới và cập nhật DB.
10. **Secret lạc trong repo:** dừng trước commit/push, di chuyển và rotate nếu có khả năng đã lộ.
11. **Docker engine không có:** vẫn chạy test Node và audit tĩnh; QA phải ghi giới hạn, không giả lập kết
    quả build Linux.
12. **Rollback:** rollback app không tự rollback schema; schema phải tương thích ngược, nếu không thì
    dừng ghi và restore backup theo cửa sổ bảo trì được duyệt.

## 8. Acceptance criteria (Given/When/Then)

1. **Monorepo đúng:** Given repo có `client/` và `server/`, When cấu hình Render, Then backend dùng Root
   Directory `server`, Dockerfile `Dockerfile`, context `.`, không cần tách repo và không build FE.
2. **Bind Render:** Given Render inject một `$PORT` bất kỳ, When container start với DB hợp lệ, Then HTTP
   server bind `0.0.0.0:$PORT` và nhận được request từ proxy.
3. **Readiness thật:** Given DB connected, When Render GET `/api/health`, Then nhận `200`, `ok: true`,
   `database: "connected"`; Given DB unavailable, Then app không được báo healthy giả hoặc fallback JSON.
4. **Docker an toàn:** Given build context `server/`, When build final image, Then dùng Node 22, lockfile,
   chạy non-root và không chứa `.env`, frontend, test, docs, migration hoặc secret.
5. **SQL production:** Given biến `DB_*` hợp lệ và firewall cho phép Render, When backend start, Then dùng
   SQL Authentication/TLS và đọc catalog/ghi đơn bằng quyền runtime tối thiểu.
6. **Config fail-closed:** Given thiếu credential, dùng Windows auth, CORS wildcard hoặc TLS không an
   toàn trong production, When start, Then process fail với lỗi đã lọc và không in secret.
7. **CORS:** Given `CORS_ORIGIN` là origin Vercel, When GET/POST/preflight từ origin đó, Then header đúng;
   origin lạ không được phép và production không dùng `*`.
8. **FE handoff:** Given URL backend khỏe, When Vercel được build lại với
   `VITE_API_URL=https://<backend>.onrender.com/api`, Then request API và `/images` đi tới backend, không
   hardcode hostname trong source.
9. **Ảnh bền theo deploy:** Given ảnh đã commit trong `server/public/images/`, When Render build/deploy
   image mới, Then `/images/...` trả file tương ứng; tài liệu nói rõ runtime write là ephemeral.
10. **API không regress:** Given code hoàn tất, When chạy `npm test`, Then toàn bộ test backend pass và
    method/path/schema/status của API hiện hữu không đổi.
11. **Gate:** Given bàn giao QA, When chạy `npm run verify`, Then backend test và frontend build đều pass;
    Docker verification được chạy nếu engine có sẵn hoặc giới hạn được ghi rõ.
12. **Runbook đủ dùng:** Given chủ repo chưa quen Render, When làm theo tài liệu, Then biết nhập đúng mọi
    field/env, chuẩn bị DB/firewall, kiểm tra health/catalog/ảnh/CORS, đọc log và rollback mà không đoán.
13. **Secret an toàn:** Given `git status` có file nghi nhạy cảm, When chuẩn bị commit/push, Then file không
    được stage/commit, nội dung không xuất hiện trong log/docs và chủ repo nhận hướng dẫn di chuyển/rotate.

## 9. Điều kiện bàn giao

`be-coder` chỉ bàn giao khi `npm test` pass và đã báo rõ Docker có/không được kiểm chứng. Deploy thật chỉ
được thực hiện khi chủ repo có: (1) GitHub repo đã push an toàn, (2) SQL Server production reachable qua
TCP + SQL Authentication + TLS, (3) URL Vercel production, và (4) quyền truy cập Render/Vercel. Đây là
trạng thái/tài khoản bên ngoài nên không tự deploy trong task code.
