# Task: Rà soát file và tách deploy FE Vercel / BE Docker trên Render

- **Ngày:** 2026-09-24
- **Nguồn yêu cầu:** Chủ repo
- **Loại:** Frontend + backend/vận hành, không đổi nghiệp vụ
- **Quy trình:** fallback theo vai trò vì CrewAI trả 401; `analyst -> be-coder -> fe-coder -> tester`
- **Ràng buộc:** không thêm/bớt dependency, không đổi hợp đồng API, không sửa `package.json` gốc hoặc `.github/workflows/**`, không commit/push/deploy thật, không làm mất thay đổi chưa commit.

## 1. Mục tiêu và bối cảnh

Chuẩn bị repo để:

1. Frontend React/Vite được build và deploy độc lập trên Vercel.
2. Backend Express được đóng gói thành Docker image Linux portable và có hướng dẫn tạo Docker Web Service trên Render.
3. FE gọi đúng API và tải đúng ảnh từ domain BE sau khi tách origin.
4. Có hướng dẫn tiếng Việt, tuần tự, nêu rõ biến môi trường, health check, kiểm tra sau deploy và rollback.
5. Rà soát file trước khi xóa; chỉ xóa artifact chắc chắn tái tạo được, tuyệt đối không suy đoán file nguồn là “không cần thiết”.

Hiện trạng quan trọng:

- FE đã hỗ trợ `VITE_API_URL`; `productImages.js` tự suy ra origin ảnh từ URL API.
- `client/index.html` vẫn preload `/images/catalog/noi-chao.jpg` theo cùng origin, nên khi FE ở Vercel nó sẽ gọi nhầm Vercel thay vì BE.
- BE đã đọc `PORT`, có `GET /api/health`, CORS allowlist và `TRUST_PROXY`; production hiện khởi động chỉ sau khi kết nối SQL Server thành công.
- Docker Linux không dùng được Windows Integrated Authentication của máy local. Production container phải dùng SQL Authentication qua driver `mssql`/`tedious` đã có sẵn.
- SQL Server `DoCuQuangHuy` vẫn là nguồn runtime. Không đóng gói SQL Server chung với container app và không chuyển database sang hệ khác.
- Vercel/Render là hai origin khác nhau, vì vậy `CORS_ORIGIN` phải chứa đúng origin HTTPS của FE.

## 2. Kết quả rà soát và chính sách dọn dẹp

### 2.1 Trạng thái chưa commit phải được bảo toàn

Tại thời điểm phân tích, repo đã có các thay đổi không thuộc task này:

- `README.md` đang sửa.
- `.gitattributes`, `run.bat`, `run.sh`, task/QA về script khởi chạy đang untracked.

Các file trên là công việc hiện hữu của chủ repo/agent trước, **không được xóa, revert hoặc ghi đè**. Trước và sau mỗi vai trò phải đối chiếu `git status --short`; chỉ được chạm file thuộc phạm vi vai trò và task này.

### 2.2 Phân loại

| Nhóm | Kết luận | Xử lý |
|---|---|---|
| `client/dist/` (~0,5 MB lúc khảo sát) | Artifact build, gitignored, tái tạo bằng `npm run build` | Có thể dọn sau khi QA hoàn tất; không tính là source bị xóa |
| `client/node_modules/`, `server/node_modules/`, `tools/node_modules/` | Dependency local tái tạo được nhưng đang cần để làm việc/verify | Giữ; chỉ xóa khi chủ repo chủ động chạy `clean deep` |
| `crew/.venv/` | Môi trường CrewAI lớn nhưng vẫn là công cụ dự án | Giữ; lỗi 401 không biến nó thành file rác |
| `server/.env`, `crew/.env` | Secret/cấu hình local, đã gitignore | Giữ, không đọc/in nội dung vào log hoặc tài liệu |
| `tools/artifacts/.gitkeep` | Giữ cấu trúc thư mục test | Giữ |
| `server/data/products.json`, `chat-knowledge.json` | Fixture/seed và tri thức chatbot | Giữ |
| `server/database/**`, `server/public/images/**` | Migration/seed và asset runtime | Giữ |
| `server/scripts/deploy.ps1` | Quy trình deploy Windows hiện hữu | Giữ; Docker là phương án bổ sung |
| `.agents/**`, `docs/tasks/**`, `docs/qa/**` | Cấu hình agent và audit trail | Giữ |

Kết luận audit: **không có file tracked nào đủ căn cứ để xóa**. Không dùng `git clean`, không xóa hàng loạt theo đuôi/glob, không đụng file untracked nêu trên. Nếu cần bàn giao repo gọn, chỉ chạy clean an toàn để dọn `client/dist`/cache/artifact, không chạy `clean deep`.

## 3. User stories

1. Là chủ shop, tôi muốn đưa giao diện lên Vercel và backend lên hosting Docker mà không phải sửa URL thủ công trong source.
2. Là người vận hành, tôi muốn container chạy được trên Linux, nhận cổng từ hosting, có health check và dừng sạch khi deploy/restart.
3. Là khách hàng, tôi muốn danh mục, ảnh, chatbot và đặt hàng hoạt động như local dù FE/BE ở hai domain khác nhau.
4. Là chủ repo, tôi muốn biết chính xác file nào đã dọn và chắc chắn các thay đổi chưa commit không bị mất.

## 4. Kiến trúc triển khai được chốt

```text
Trình duyệt
  -> https://<frontend>.vercel.app        (React/Vite static)
  -> https://<backend>.onrender.com/api   (Express trong Docker)
  -> https://<backend>.onrender.com/images/*
Backend Docker
  -> SQL Server/Azure SQL có TCP endpoint mà Render truy cập được
```

- Vercel chỉ build/serve `client/`; không chạy Express, không chứa ảnh catalog runtime.
- Render chỉ build/run `server/`; không cần `client/dist` và không build FE trong Docker image.
- Docker image không chứa `.env`, `node_modules` từ máy dev, Git metadata, test artifact hay secret.
- Container chạy bằng user không phải root, dùng Node.js 22, lệnh runtime `npm start`, lắng nghe `0.0.0.0:$PORT` theo hành vi Node/Express hiện có.
- Docker build context chuẩn là `server/`. Tạo `server/Dockerfile` và `server/.dockerignore`; không yêu cầu đổi package root/CI.
- Phải có stage/luồng kiểm chứng Linux chạy được mà không cần DB thật (chạy test memory hiện hữu). Final image chỉ chứa thành phần runtime cần thiết.
- Không cài thêm npm dependency. Không cài ODBC/Windows auth cho luồng production Render: `DB_AUTH_MODE=sql` khiến app dùng `mssql`/`tedious` thuần JavaScript đã có.

## 5. Hợp đồng cấu hình

### 5.1 Frontend Vercel

| Biến/thiết lập | Giá trị/hợp đồng |
|---|---|
| Root Directory | `client` |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Node.js | 22.x |
| `VITE_API_URL` | URL tuyệt đối HTTPS, dạng `https://<backend>.onrender.com/api`, không có dấu `/` cuối |

- Bổ sung cấu hình SPA rewrite trong `client/` để refresh trực tiếp `/san-pham`, `/cart`, `/product/:id` không trả 404.
- Sửa preload ảnh trong `client/index.html`: không được tiếp tục request `/images/...` trên origin Vercel. Có thể bỏ preload tĩnh; không copy/nhúng toàn bộ ảnh BE vào bundle FE.
- Không hardcode hostname Render trong source. Production URL chỉ đi qua `VITE_API_URL` tại build time.
- Nếu đổi `VITE_API_URL`, phải redeploy FE vì biến `VITE_*` được Vite đóng vào bundle lúc build.

### 5.2 Backend Docker/Render

Biến bắt buộc:

| Biến | Giá trị production |
|---|---|
| `NODE_ENV` | `production` |
| `DB_AUTH_MODE` | `sql` |
| `DB_SERVER` | Hostname TCP của SQL Server; không dùng `.\\SQLEXPRESS`, `localhost` hoặc private PC không có route |
| `DB_PORT` | Thường là `1433`, theo nhà cung cấp DB |
| `DB_NAME` | `DoCuQuangHuy` hoặc database production đã migrate |
| `DB_USER` | Runtime login quyền tối thiểu |
| `DB_PASSWORD` | Secret của runtime login |
| `DB_TRUSTED_CONNECTION` | `false` |
| `DB_ENCRYPT` | `true` |
| `DB_TRUST_SERVER_CERTIFICATE` | `false` |
| `CORS_ORIGIN` | Origin FE chính xác, ví dụ `https://<frontend>.vercel.app`; nhiều origin phân tách dấu phẩy |
| `TRUST_PROXY` | `1` khi app đứng ngay sau proxy Render |

Biến do nền tảng cấp/tuỳ chọn:

- `PORT`: Render cấp; không đặt cứng trong Docker hoặc dashboard nếu không cần.
- `DB_DRIVER`: bỏ trống hoặc dùng `tedious`/`mssql` theo validation hiện hữu; tuyệt đối không dùng `msnodesqlv8` cho SQL Authentication.
- `DB_CONNECT_TIMEOUT_MS`, `DB_REQUEST_TIMEOUT_MS`, `DB_POOL_MAX`, `DB_POOL_MIN`, `DB_POOL_IDLE_TIMEOUT_MS`: giữ mặc định hoặc cấu hình theo `server/.env.example`.
- `XKIRO_API_KEY`, `XKIRO_MODEL`, `XKIRO_API_BASE`, `XKIRO_TIMEOUT_MS`: tuỳ chọn; thiếu key thì chatbot fallback như hiện tại.
- `RATE_LIMIT_*`, `ORDER_RATE_*`, `CHAT_RATE_MAX`: tuỳ chọn theo runbook hiện hữu.

Hợp đồng Render:

- Service type: Web Service, runtime Docker, Docker context/root `server`, Dockerfile `server/Dockerfile` (đường dẫn nhập trên dashboard phụ thuộc việc Root Directory có đặt là `server` hay không; tài liệu phải nêu cả hai cách và chọn một cách nhất quán).
- Health Check Path: `/api/health`.
- Deploy chỉ được coi là khỏe khi endpoint trả `200`, `ok: true`, `database: "connected"`.
- Không chạy migration/seed destructive trong Docker `ENTRYPOINT`/`CMD`. Schema/seed được chuẩn bị riêng, có backup, theo `server/docs/DATABASE.md`.
- Không ghi secret vào Dockerfile, image layer, repo hoặc ảnh chụp màn hình.

### 5.3 Điều kiện hạ tầng database

SQL Server Express trên máy Windows local hiện tại không tự nhiên truy cập được từ Render. Trước deploy thật, chủ repo phải có SQL Server/Azure SQL/nhà cung cấp tương thích với:

- TCP endpoint công khai hoặc private network mà Render truy cập được;
- SQL Authentication (không phải Windows Authentication);
- TLS/certificate hợp lệ để giữ `DB_ENCRYPT=true`, `DB_TRUST_SERVER_CERTIFICATE=false`;
- firewall allowlist phù hợp outbound của gói Render đang dùng;
- schema/migration và runtime user quyền tối thiểu đã chuẩn bị.

Không hướng dẫn mở thẳng SQL Express trên máy cá nhân ra Internet như phương án production. Nếu chưa có DB đáp ứng các điều kiện trên, dừng ở bước build/test image và ghi `NEEDS_INPUT`; không giả vờ deploy thành công.

## 6. Hợp đồng API và CORS

Không đổi method, path, body, response hay mã lỗi của:

- `GET /api/health`
- `GET /api/categories`
- `GET /api/products`
- `GET /api/products/:id`
- `POST /api/orders`
- `POST /api/chat`
- `GET /images/*`

Hành vi cross-origin bắt buộc:

- Request có `Origin` đúng `CORS_ORIGIN` nhận `Access-Control-Allow-Origin` đúng origin đó.
- Preflight `OPTIONS` cho `POST /api/orders` và `POST /api/chat` thành công với method/header hiện hữu.
- Origin lạ không nhận header cho phép truy cập; production không dùng `*`.
- Vercel Preview URL thay đổi theo deployment sẽ không tự được phép. Chỉ dùng domain production/alias ổn định, hoặc thêm từng origin preview cụ thể vào allowlist rồi restart/redeploy BE. Không mở wildcard để tiện test.

## 7. Phạm vi triển khai theo vai trò

### 7.1 `be-coder`

Được tạo/sửa trong `server/**`:

- Tạo `server/Dockerfile` Linux portable, Node 22, non-root, final image tối giản, không secret.
- Tạo `server/.dockerignore`.
- Cập nhật `server/.env.example` với khối Docker/Render SQL Authentication rõ ràng nhưng không có secret thật.
- Cập nhật `server/docs/PRODUCTION-RUNBOOK.md` (hoặc tài liệu deploy riêng dưới `server/docs/`) với hướng dẫn build/run Docker và Render từng bước, health check, log, rollback, DB prerequisite.
- Chỉ sửa code server nếu kiểm chứng Docker phát hiện lỗi portability thực sự; không đổi API/dependency/package root.
- Chạy `npm test`; nếu máy có Docker thì build stage test/final và chạy test trong Linux image. Nếu Docker không có, ghi rõ giới hạn bằng chứng, không tuyên bố image đã chạy.

### 7.2 `fe-coder`

Được tạo/sửa trong `client/**`:

- Tạo cấu hình Vercel SPA trong `client/`.
- Xử lý preload ảnh same-origin sai trong `client/index.html` mà không nhúng/copy ảnh BE.
- Cập nhật `client/README.md` với hướng dẫn import project Vercel, root/build/output/env và redeploy.
- Không đổi UI/design, component, API contract hoặc dependency.
- Chạy `npm run build` với một `VITE_API_URL` HTTPS mẫu hợp lệ và kiểm tra bundle không hardcode `localhost:3000`, không còn preload `/images/...` sai origin.

### 7.3 `tester`

- Đối chiếu từng acceptance criterion, chạy `npm run verify` từ gốc.
- Nếu có Docker: build final image và test stage trên Linux; kiểm tra image không chứa `.env`/secret/dev `node_modules` từ host, chạy non-root.
- Kiểm tra SPA rewrite về mặt cấu hình và build; smoke local nếu có server/DB test phù hợp. Không tạo order trên production.
- Viết báo cáo `docs/qa/2026-09-24-don-dep-va-deploy-vercel-render-docker.md`.
- Không sửa production code. Nếu fail, phát bug đúng vai trò.

## 8. Trường hợp biên và quy tắc an toàn

1. **Render cold start:** FE phải hiển thị lỗi kết nối hiện hữu; không cache/fallback catalog giả. Health chỉ xanh sau khi DB kết nối.
2. **Sai `VITE_API_URL`:** thiếu `/api` hoặc có dấu `/` cuối có thể sinh URL sai; tài liệu và build check phải bắt được.
3. **DB chỉ hỗ trợ cert tự ký:** không hạ `DB_TRUST_SERVER_CERTIFICATE=true` trong production để “cho chạy”; cần certificate/CA đúng hoặc dừng và báo hạ tầng chưa đạt.
4. **Ảnh:** DB tiếp tục lưu `/images/...`; trình duyệt phải resolve sang origin BE qua helper hiện có.
5. **Deep link:** tải trực tiếp route React bất kỳ trên Vercel phải trả app HTML, trong khi asset thật vẫn được phục vụ bình thường.
6. **CORS preview:** URL preview động không nằm trong allowlist sẽ bị chặn có chủ đích.
7. **Secret:** QA/log không in `DB_PASSWORD`, API key hoặc connection string.
8. **Dọn dẹp:** không xóa file tracked chỉ vì chưa thấy import; không xóa `.env`, DB script, fixture, ảnh, docs, launcher hoặc môi trường dependency. `client/dist` có thể được xóa cuối cùng nhưng sẽ được build lại khi verify lần sau.
9. **Thay đổi song song:** nếu file đã dirty trước task, merge tối thiểu và giữ nguyên phần có sẵn; không dùng reset/checkout/clean.
10. **Hosting khác Render:** Docker image phải không phụ thuộc API riêng của Render; host khác chỉ cần inject env, TCP database và HTTP port tương đương.

## 9. Acceptance criteria (Given/When/Then)

1. **Audit an toàn:** Given trạng thái git ban đầu có file sửa/untracked, When hoàn tất task, Then mọi thay đổi ban đầu vẫn còn nguyên và báo cáo liệt kê chính xác artifact đã xóa; không có file tracked bị xóa nếu chưa có phê duyệt cụ thể.
2. **Dọn đúng phạm vi:** Given artifact build/cache hiện hữu, When chạy dọn an toàn, Then chỉ artifact tái tạo như `client/dist` bị xóa; `.env`, `node_modules`, `crew/.venv`, ảnh, DB scripts, fixture, docs và `.gitkeep` còn nguyên.
3. **Docker build:** Given Docker engine Linux khả dụng, When build từ context `server/`, Then final image build thành công bằng Node 22 mà không cần secret hoặc DB trong build step.
4. **Docker test:** Given test stage/container, When chạy backend tests trong Linux image, Then toàn bộ test pass mà không kết nối SQL Server thật.
5. **Runtime portable:** Given container chạy với SQL Authentication hợp lệ và `PORT` bất kỳ, When start, Then process chạy non-root, listen cổng được cấp, `/api/health` trả 200 và SIGTERM đóng sạch.
6. **Không nhét FE vào BE:** Given final Docker image, When kiểm tra nội dung/quy trình build, Then không build/copy `client/dist`; `/api/*` và `/images/*` vẫn là phạm vi BE.
7. **Vercel build:** Given `VITE_API_URL=https://example-backend.invalid/api`, When chạy build trong `client/`, Then build pass và bundle gọi origin đó, không hardcode `localhost:3000`.
8. **Ảnh tách origin:** Given product có `image: "/images/…"` và FE được build với URL BE, When resolve ảnh, Then URL trỏ tới `https://<backend>/images/…`; HTML không preload `/images/...` trên Vercel origin.
9. **SPA routing:** Given FE đã deploy, When mở/refresh trực tiếp route React (`/san-pham`, `/cart`, `/product/:id`), Then Vercel trả app thay vì 404; file asset thật không bị rewrite sai.
10. **CORS đúng origin:** Given `CORS_ORIGIN` chứa origin Vercel, When gọi GET/POST/preflight từ origin đó, Then browser nhận header hợp lệ; origin khác không được phép và production không dùng wildcard.
11. **API không regress:** Given deployment split-origin, When gọi toàn bộ endpoint hiện hữu, Then method/path/schema/status vẫn đúng hợp đồng trước task; `npm test` pass.
12. **Hướng dẫn đủ dùng:** Given một chủ repo chưa quen deploy, When làm theo tài liệu Vercel và Render, Then biết chọn root/build/output/Dockerfile/health path, khai báo từng env, chuẩn bị DB, verify URL, xem log và rollback mà không cần đoán secret/command.
13. **Gate:** Given code hoàn tất, When chạy `npm run verify`, Then backend tests và frontend build pass; nếu có môi trường smoke phù hợp thì `npm run smoke` pass mà không chạy trên production.

## 10. Trình tự handoff

1. `be-coder`: Docker + tài liệu Render + env mẫu, `npm test` pass; không cần đổi API.
2. `fe-coder`: cấu hình Vercel + xử lý asset/preload + tài liệu FE, `npm run build` pass.
3. `tester`: `npm run verify`, Docker verification nếu có engine, smoke phù hợp, lập QA report.
4. Deploy thật cần tài khoản Vercel/Render, repository đã push và SQL Server production truy cập được; đây là thao tác external có trạng thái, chỉ thực hiện khi chủ repo cung cấp/cho phép. Trong task hiện tại chỉ chuẩn bị repo và hướng dẫn.
