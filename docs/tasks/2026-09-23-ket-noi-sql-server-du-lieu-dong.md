# Kết nối SQL Server Express bằng Windows Authentication — dữ liệu động

- **Ngày:** 2026-09-23
- **Loại:** Thay đổi backend/data (không đổi giao diện)
- **Trạng thái:** Đã phân tích, chờ `be-coder` triển khai
- **Nguồn yêu cầu:** chủ repo cung cấp instance `.\SQLEXPRESS`, dùng Windows Integrated Security

## 1. Mục tiêu và bối cảnh

Chuyển nguồn dữ liệu vận hành của backend từ `server/data/products.json` và
`server/data/orders.json` sang SQL Server Express. Sau khi triển khai:

- `Categories`, `Products`, `ProductImages`, `ProductSpecs`, `PromoCodes`, `Orders` và
  `OrderItems` trong database `DoCuQuangHuy` là **nguồn sự thật duy nhất lúc chạy**.
- Sửa dữ liệu bằng SSMS phải được API phản ánh mà không phải sửa source hoặc khởi động lại
  server. Có thể dùng cache ngắn tối đa 30 giây cho catalog; nếu có cache phải tự hết hạn,
  không nạp catalog cố định khi `require()`/khởi động.
- `POST /api/orders` ghi đơn theo transaction vào SQL Server; không còn ghi `orders.json`.
- Giữ nguyên 100% URL, request/response và luật nghiệp vụ mà frontend đang dùng.
- Chatbot RAG hiện có tiếp tục hoạt động, nhưng catalog dùng để truy xuất phải lấy từ DB động;
  FAQ trong `server/data/chat-knowledge.json` vẫn là file tĩnh và không thuộc migration này.

**Lưu ý thuật ngữ:** SSMS chỉ là công cụ quản trị. Backend kết nối trực tiếp tới SQL Server
instance `.\SQLEXPRESS`, không "kết nối vào SSMS".

## 2. User stories

1. Là chủ shop, tôi muốn thêm/sửa danh mục, sản phẩm, giá, ảnh và mã giảm giá trong SQL
   Server bằng SSMS để website dùng dữ liệu mới mà không phải sửa code/JSON.
2. Là khách mua hàng, tôi muốn catalog, trang chi tiết, chatbot và đơn hàng luôn dùng cùng dữ
   liệu hiện tại trong database.
3. Là người vận hành, tôi muốn endpoint health báo đúng trạng thái database và server không
   nhận traffic khi chưa kết nối DB, để không trả catalog rỗng hoặc nhận đơn nhưng không lưu.

## 3. Kết nối và cấu hình môi trường

### 3.1 Chuỗi kết nối được chốt

Chuỗi chủ repo cung cấp là ADO.NET và **thiếu database đích**:

```text
Data Source=.\SQLEXPRESS;Integrated Security=True;Persist Security Info=False;Pooling=False;MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=True;Application Name="SQL Server Management Studio";Command Timeout=0
```

Node không được hardcode chuỗi này. `server/.env` dùng cấu hình tương đương sau:

```dotenv
DB_SERVER=.\SQLEXPRESS
DB_NAME=DoCuQuangHuy
DB_DRIVER=msnodesqlv8
DB_TRUSTED_CONNECTION=true
DB_ENCRYPT=true
DB_TRUST_SERVER_CERTIFICATE=true
DB_CONNECT_TIMEOUT_MS=10000
DB_REQUEST_TIMEOUT_MS=15000
DB_POOL_MAX=10
DB_POOL_MIN=0
DB_POOL_IDLE_TIMEOUT_MS=30000
```

`server/.env.example` chỉ chứa ví dụ trên, không chứa mật khẩu/token. Integrated Security dùng
Windows identity của **tiến trình Node**; tài khoản chạy VS Code/PowerShell (hoặc service account
khi deploy) phải có quyền vào `DoCuQuangHuy`.

Không dùng `Command Timeout=0` trong ứng dụng vì đó là chờ vô hạn. App chuyển thành timeout
hữu hạn 15 giây. Không ép `Pooling=False`: `node-mssql` cần một pool dùng chung; pool tối đa 10
kết nối là cấu hình vận hành tương đương an toàn. `MultipleActiveResultSets` không được yêu cầu.

### 3.2 Driver Windows Authentication

- Dùng adapter `mssql/msnodesqlv8` và cài dependency trực tiếp `msnodesqlv8`; driver mặc định
  `tedious` của package `mssql` không đáp ứng Windows Integrated Security.
- Máy chạy cần SQL Server Express và Microsoft ODBC Driver for SQL Server phù hợp.
- Named instance phải được truyền nguyên dạng `.\SQLEXPRESS`/`localhost\SQLEXPRESS`; không
  tách nhầm `SQLEXPRESS` thành database. Nếu discovery named instance bị chặn, người vận hành
  bật SQL Server Browser/TCP hoặc cấu hình port tĩnh ngoài source code.
- `Encrypt=true` và `TrustServerCertificate=true` giữ đúng yêu cầu local của chủ repo. Khi lên
  production có chứng chỉ tin cậy thì đổi `DB_TRUST_SERVER_CERTIFICATE=false` qua env.
- Việc thêm `msnodesqlv8` là thay đổi dependency bắt buộc do yêu cầu Windows Authentication
  đã được chủ repo chỉ định; không thêm ORM/framework DB.

## 4. Kiến trúc backend và nguồn dữ liệu

### 4.1 Tách lớp truy cập dữ liệu

Tạo lớp DB/repository dưới `server/lib/`, không đặt câu SQL rải trong route:

- `db.js`: tạo đúng **một** connection pool, `connect()`, `close()`, trạng thái readiness và
  parse/validate env. Không log connection string hoặc thông tin xác thực.
- `catalog-repository.js`: `listCategories()`, `listProducts(filters)`, `getProductById(id)`,
  `listRelatedProducts(categoryKey, excludedId, limit)`. Các hàm trả đúng model API ở mục 5.
- `order-repository.js`: `createOrder(input)` chạy transaction/stored procedure và trả toàn bộ
  order đã lưu. Mọi giá/tổng tiền lấy từ DB, không tin giá client.

`server.js` nhận repository bằng factory/dependency injection. Production dùng SQL repository;
test truyền fake repository trong bộ nhớ. Không có nhánh production âm thầm fallback về JSON:
DB lỗi phải là lỗi rõ ràng, không trả dữ liệu cũ như thể đang thành công.

### 4.2 Ánh xạ schema → JSON API

- `Categories.CategoryKey/Label/ImageUrl` → `{ key, label, image }`.
- `Products.ProductId/Name/CategoryKey/Price/OldPrice/Rating/Sold/Badge/Description/ImageUrl`
  + `Categories.Label` + `ProductImages` + `ProductSpecs` →
  `{ id, name, category, categoryLabel, price, oldPrice, rating, sold, badge, description,
  image, images, specs }`.
- Giá trị `DECIMAL` phải được đổi thành JavaScript `number`, không để string/BigInt lọt ra API.
- `images` và `specs` luôn là mảng theo `SortOrder`; `image` luôn string hoặc `null`. Không tạo
  bản sao ảnh chính trong gallery nếu schema/seed hiện hành không có nó; trả đúng các dòng DB.
- Ảnh tiếp tục chỉ lưu đường dẫn tương đối `/images/...`; file vật lý vẫn ở
  `server/public/images/`. Cảnh báo ảnh thiếu phải chạy trên catalog lấy từ DB, không đọc JSON.

### 4.3 Truy vấn động và an toàn

- Mọi input (`cat`, `q`, `id`, limit và dữ liệu đơn) phải dùng parameter binding; cấm nối chuỗi
  SQL từ input.
- `GET /api/categories`, `GET /api/products` và `GET /api/products/:id` là async. Có thể query
  mỗi request hoặc cache RAM tối đa 30 giây; cập nhật trong SSMS phải hiện sau tối đa 30 giây.
- Lọc `cat`, tìm tên `q` không phân biệt hoa/thường và dấu theo collation hiện tại
  `Vietnamese_100_CI_AI`. Sort whitelist: `price-asc`, `price-desc`, `rating`; giá trị khác mặc
  định `Sold DESC`, giống API hiện tại. Có tie-breaker `ProductId ASC` để kết quả ổn định.
- Không dùng `SELECT *`; alias rõ tên cột. Related cùng danh mục, loại sản phẩm hiện tại,
  `TOP (4)` và thứ tự ổn định.

### 4.4 Tạo đơn hàng

- Giữ validation request tại HTTP layer để trả lỗi trường như hiện tại; DB tiếp tục enforce
  constraint/transaction. Gộp id trùng trước khi ghi và kiểm tra **tổng qty sau gộp** trong 1–99.
- Dùng TVP `dbo.OrderItemType` + `dbo.usp_TaoDonHang` hoặc transaction parameterized tương
  đương. Stored procedure phải nguyên tử: lỗi bất kỳ thì không có order/order-item dở dang.
- Giá, tên snapshot, promo, shipping và total lấy từ transaction DB. Không dùng constant
  `PROMO_CODES`/catalog JSON ở runtime.
- Giữ luật hiện tại của API: standard 30.000đ và miễn phí khi subtotal ≥ 500.000đ; express
  luôn 45.000đ. Script SQL hiện tại đang miễn phí cả express khi đạt ngưỡng nên BE phải sửa
  migration/procedure trước khi dùng.
- Sau insert, đọc lại order cùng items trong cùng luồng để dựng response mục 5; `createdAt`
  trả ISO UTC. Unique collision `OrderCode` phải retry hữu hạn trong DB/transaction.

### 4.5 Chatbot không regress

`createChatHandler` phải nhận async catalog provider/repository (hoặc tương thích cả provider
và mảng trong test). Mỗi request chat lấy catalog hiện tại, có thể chia sẻ cache catalog tối đa
30 giây. Giữ nguyên validation, rate limit, xKiro/fallback, format response và toàn bộ test chat.
DB lỗi khi lấy catalog không được làm lộ stack/connection; endpoint trả `503` JSON thống nhất.

## 5. Hợp đồng API (ràng buộc BE và FE)

Không đổi frontend và không đổi path/field thành công hiện hữu.

### `GET /api/health`

Khi DB sẵn sàng — `200`:

```json
{
  "ok": true,
  "name": "inox-store-api",
  "version": "1.2.0",
  "uptime": 12,
  "time": "2026-09-23T01:00:00.000Z",
  "database": "connected"
}
```

Khi app đang chạy nhưng DB mất kết nối — `503` (không cache):

```json
{
  "ok": false,
  "name": "inox-store-api",
  "version": "1.2.0",
  "uptime": 12,
  "time": "2026-09-23T01:00:00.000Z",
  "database": "disconnected",
  "error": "Cơ sở dữ liệu chưa sẵn sàng."
}
```

Không trả host, tên user, connection string hay nội dung exception. `database` là field mới
không phá client; các field success cũ được giữ nguyên.

### `GET /api/categories`

`200` giữ nguyên array:

```json
[{ "key": "ban-ghe", "label": "Bàn ghế & ghế nhựa", "image": "/images/catalog/ban-ghe.svg" }]
```

### `GET /api/products?cat=&q=&sort=`

`200` giữ nguyên array product, đủ các field:

```json
[
  {
    "id": 1,
    "name": "Ghế nhựa bành lớn (còn như mới)",
    "category": "ban-ghe",
    "categoryLabel": "Bàn ghế & ghế nhựa",
    "price": 85000,
    "oldPrice": 120000,
    "rating": 4.8,
    "sold": 214,
    "badge": "hot",
    "description": "...",
    "image": null,
    "images": [],
    "specs": ["..."]
  }
]
```

`cat=all` như không lọc; `q` trim; sort theo mục 4.3. Query không hợp lệ không gây 500.

### `GET /api/products/:id`

- `200`: `{ "product": <product>, "related": [<product>, ...] }`, related tối đa 4.
- `404`: `{ "error": "Không tìm thấy sản phẩm" }` nếu id không phải số nguyên dương hoặc
  không có trong DB.

### `POST /api/orders`

Request giữ nguyên:

```json
{
  "items": [{ "id": 1, "qty": 2 }],
  "delivery": "standard",
  "payment": "cod",
  "promoCode": "QUANGHUY10",
  "customer": {
    "name": "Nguyễn Văn A",
    "phone": "0901234567",
    "address": "12 Nguyễn Huệ, Quận 1, TP.HCM",
    "note": "Gọi trước"
  }
}
```

- `201`: `{ "order": { "code", "items", "delivery", "payment", "promoCode",
  "subtotal", "shippingFee", "discount", "total", "customer", "createdAt" } }`; item giữ
  `{ id, name, price, qty }`; code khớp `^DI\d{8}$`.
- `400` validation giữ nguyên: `{ "error": "Dữ liệu đơn hàng chưa hợp lệ.", "fields": {...} }`
  hoặc lỗi qty/sản phẩm không tồn tại như hiện tại.
- Race condition sản phẩm bị xóa/đổi trong lúc đặt phải được transaction xử lý; không trả 201
  nếu chưa commit.

### `POST /api/chat`

Giữ nguyên toàn bộ contract trong
`docs/tasks/2026-09-22-ai-chatbot-rag-tro-ly-khach-hang.md`. Chỉ thay nguồn product sang DB.

### Lỗi database chung

Các catalog/order/chat route gặp lỗi connect, timeout hoặc query ngoài lỗi nghiệp vụ trả:

```json
{ "error": "Cơ sở dữ liệu tạm thời không sẵn sàng. Vui lòng thử lại sau." }
```

với HTTP `503`, `Cache-Control: no-store`; log server có mã lỗi/request context nhưng đã loại
connection string/secret. Không trả catalog rỗng, không fallback JSON, không trả stack trace.

## 6. Khởi động, shutdown và migration/seed

### Startup/readiness

1. Parse env và tạo pool.
2. Kết nối + chạy probe `SELECT 1` trong `DB_CONNECT_TIMEOUT_MS`.
3. Chỉ sau khi probe thành công mới `listen()`. Nếu thất bại, log thông báo ngắn và thoát
   process code khác 0; không tự tạo database/schema và không mở server với dữ liệu rỗng.
4. Khi pool lỗi sau startup, readiness `/api/health` trả 503; pool có thể reconnect theo cơ chế
   có giới hạn của adapter. Request DB trong thời gian đó trả 503.
5. `SIGINT`/`SIGTERM`: ngừng nhận request, đóng HTTP server rồi `pool.close()`; có timeout chốt.

### Migration và seed an toàn

- **Tuyệt đối không tự chạy** `server/database/do-cu-quang-huy.sql` khi startup/test. File hiện
  có `DROP VIEW/PROC/TYPE/TABLE` và sẽ xóa dữ liệu đang có.
- Tách bootstrap/migration không phá dữ liệu: chỉ tạo object khi chưa tồn tại hoặc dùng migration
  có version; thay procedure bằng `CREATE OR ALTER PROCEDURE`. Không `DROP TABLE`, không xóa
  order, không reseed identity trong luồng kết nối app.
- Seed là lệnh thủ công, tách khỏi startup, chạy trong transaction và idempotent (`MERGE` hoặc
  `IF NOT EXISTS`). Mặc định chỉ chèn row thiếu theo khóa, không overwrite dữ liệu chủ shop đã
  sửa trong SSMS. Có dry-run/preview hoặc tài liệu liệt kê số row trước khi áp dụng.
- Trước lần seed đầu tiên phải backup DB. Script destructive hiện hữu chỉ dùng cho database dev
  trống khi chủ repo chủ động xác nhận; không được BE/QA tự chạy trên instance người dùng.
- `products.json` có thể được giữ tạm làm **nguồn seed một lần/test fixture**, nhưng runtime
  production không đọc nó. `orders.json` cũng chỉ là dữ liệu migration lịch sử, không còn được ghi.

## 7. Kiểm thử bắt buộc

CI và `npm test` **không được phụ thuộc** máy có SQL Server/ODBC/Windows account:

- App/routes được tạo qua factory nhận repository; unit/API test truyền fake repository có dữ
  liệu fixture. Không kết nối `.\SQLEXPRESS`, không đọc credential, không chạy migration.
- Test repository SQL mock/inject pool/request để kiểm tra câu lệnh parameterized, ánh xạ DECIMAL,
  ảnh/specs có thứ tự, transaction commit/rollback và mapping lỗi; không mock để bỏ qua logic.
- Có test startup: connect thành công mới listen; connect thất bại không listen/thoát theo contract.
- Có test health 200 khi ready và 503 khi disconnected; DB route failure trả 503/no-store.
- Giữ và cập nhật toàn bộ test API hiện hữu theo dependency injection; không xóa test để pass.
- Test order: giá server/DB, merge duplicate, merged qty >99, product không tồn tại, promo active,
  standard free ship, express vẫn 45.000đ, rollback, response đúng schema.
- Test dữ liệu động: fake repository đổi dữ liệu giữa hai request (hoặc hết TTL) thì response đổi
  mà không reload module/restart server.
- `chat.test.js` và `chat-rate.test.js` phải pass; thêm test chat dùng catalog provider mới.
- Integration test SQL thật là opt-in qua env (ví dụ `RUN_SQL_INTEGRATION=1`), chỉ chạy trên DB
  test riêng và transaction rollback; không nằm trong gate mặc định nếu CI không có SQL Server.

## 8. Phạm vi file dự kiến

### Backend được sửa

- `server/server.js`
- `server/lib/db.js` (mới)
- `server/lib/catalog-repository.js` (mới)
- `server/lib/order-repository.js` (mới)
- `server/lib/chat.js` (chỉ phần cấp catalog động)
- `server/.env.example`
- `server/package.json`, `server/package-lock.json` (thêm driver Windows Auth bắt buộc)
- `server/database/**` (migration/seed không phá dữ liệu + sửa stored procedure)
- `server/docs/DATABASE.md`
- `server/test/**`

### Không thuộc phạm vi

- Không sửa `client/**`: API contract thành công không đổi.
- Không đổi UI/chat UX, provider xKiro, FAQ, ảnh vật lý hoặc CI/CD.
- Không tự chạy SQL destructive, không tự xóa JSON lịch sử, không migrate DB khác, không
  commit/push/deploy.

## 9. Acceptance criteria (Given/When/Then)

1. **Kết nối Windows Auth:** Given SQL Express `.\SQLEXPRESS`, DB `DoCuQuangHuy` và Windows
   identity có quyền, When chạy backend với env mẫu, Then pool kết nối encrypted thành công mà
   không cần username/password trong source.
2. **Fail-fast:** Given DB tắt/sai instance, When khởi động production server, Then không listen,
   log lỗi đã che thông tin nhạy cảm và exit khác 0 trong timeout hữu hạn.
3. **Health/readiness:** Given DB mất kết nối sau startup, When gọi `/api/health`, Then 503 đúng
   schema; khi DB sẵn sàng Then 200, `ok:true`, `database:"connected"` và giữ field cũ.
4. **Catalog động:** Given sửa tên/giá/category/spec/image trong SSMS, When gọi API sau tối đa 30
   giây, Then categories/list/detail phản ánh DB mới mà không sửa JSON hay restart.
5. **Contract catalog:** Given DB seed hợp lệ, When gọi ba GET catalog, Then status/JSON/filter/
   search/sort/related/404 giống hợp đồng mục 5 và numeric field là number.
6. **Đơn bền vững:** Given request order hợp lệ, When POST, Then 201 chỉ sau commit; Orders và
   OrderItems có đủ snapshot/tổng tiền và response giữ đúng contract.
7. **Luật tiền:** Given các trường hợp standard dưới/trên 500.000đ, express trên 500.000đ và mã
   promo active/inactive, Then phí/giảm/tổng đúng mục 4.4; giá client giả không ảnh hưởng.
8. **Rollback/lỗi DB:** Given query/transaction lỗi, When gọi route DB, Then không có dữ liệu dở,
   trả 503/no-store với message chung, không lộ stack/connection string và không fallback JSON.
9. **Chatbot:** Given catalog chỉ có trong SQL, When hỏi sản phẩm, Then chip/reply dùng catalog DB
   hiện tại; validation/rate limit/xKiro fallback cũ vẫn hoạt động.
10. **Migration an toàn:** Given DB đã có dữ liệu, When chạy migration/seed được tài liệu hóa,
    Then không drop bảng/đơn và seed lại không nhân bản/ghi đè row đã sửa.
11. **Test độc lập:** Given máy CI không có SQL Server/ODBC, When `npm test`, Then tất cả test pass
    nhờ repository injection/mock và không có kết nối mạng/DB thật.
12. **Gate:** Given triển khai hoàn tất, When chạy `npm test` và `npm run verify` từ gốc repo,
    Then toàn bộ test cũ + mới và build pass; frontend không regress.

## 10. Trình tự bàn giao

Task thuần backend/data nên bỏ giai đoạn FE. `be-coder` triển khai và chạy `npm test`, sau đó
handoff `tester` chạy `npm run verify`; integration SQL thật chỉ chạy khi chủ repo đã chuẩn bị
database test và bật cờ opt-in.

