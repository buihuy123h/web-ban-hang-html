# Task 2026-09-25: Hoàn thiện chuyển SQL Server sang PostgreSQL/Supabase

- **Loại:** migration hạ tầng dữ liệu, thuần backend; bỏ giai đoạn frontend vì không đổi UI/API.
- **Luồng:** ANALYZE → BACKEND → QA.
- **Trạng thái audit:** backend trong working tree **đã chuyển phần lớn sang `pg`**, nhưng chưa thể coi là hoàn tất production.
- **Không thực hiện trong giai đoạn phân tích:** không đọc secret, không kết nối/chỉnh database local hay Supabase, không build/deploy.

## 1. Kết luận audit hiện trạng

Các phần đã có trong working tree:

- `server/package.json` dùng `pg`; `server/lib/db.js` tạo `pg.Pool`.
- Catalog và đơn hàng đã dùng câu lệnh PostgreSQL có bind parameter.
- Có `server/database/postgres/schema.sql`, script apply schema và seed.
- Docker/Render docs và `.env.example` đã nhắm tới Supabase.
- Test hiện tại đã được bên điều phối xác nhận `61/61` pass bằng repository giả lập/in-memory.

Các điểm chưa đạt để tuyên bố migration hoàn tất:

1. Thay đổi vẫn chưa commit; chưa có bằng chứng tích hợp với PostgreSQL/Supabase thật.
2. `schema.sql` đang `DROP` view/function/bảng, không phải migration an toàn và có thể xóa dữ liệu.
3. Schema PostgreSQL thiếu một số ràng buộc tương đương bản SQL Server: kiểm tra số điện thoại, unique `(order_id, product_id)`, các index lịch sử quan trọng.
4. Hàm tạo đơn chưa tái kiểm tra đầy đủ name/phone/address/delivery/payment; một số JSON/cast lỗi có thể thành 503 thay vì lỗi nghiệp vụ 400.
5. Sinh mã đơn đang kiểm tra trước rồi insert, chưa retry atomically khi hai request đồng thời va unique key.
6. Schema/function ở `public` chưa chốt quyền `anon`/`authenticated`/`PUBLIC`; chưa có runtime role tối thiểu quyền.
7. Cấu hình hiện tại khuyên dùng tài khoản `postgres.<project-ref>` cho runtime, quyền quá rộng.
8. `.github/workflows/ci.yml` và `deploy.yml` vẫn dựng SQL Server, dùng `DB_*` và script `mssql`; package runtime đã bỏ `mssql` nên smoke job cũ không còn tương thích.
9. `server/database/bootstrap-ci.js` và các SQL Server script vẫn là legacy; phải không còn được runtime gọi.

Mục 8 thuộc CI/CD, theo `AGENTS.md` **không sửa khi chưa được chủ repo duyệt**. BE phải ghi rõ blocker này khi bàn giao; không tự sửa workflow.

## 2. Mục tiêu và user story

> Là chủ cửa hàng, tôi muốn backend Express chạy với PostgreSQL trên Supabase Free và Render, giữ nguyên frontend, URL/JSON/mã lỗi API và dữ liệu hiện có; migration phải lặp lại được, không tự xóa database và không lộ credential.

Kết quả mong muốn:

- PostgreSQL/Supabase là nguồn runtime duy nhất.
- Không dual-write, không fallback sang SQL Server/JSON ở production.
- ID sản phẩm, category key, order code, thời gian, snapshot tên/giá và trạng thái promo được giữ nguyên.
- FE không phải sửa.

## 3. Quyết định kết nối và biến môi trường

### Runtime

Chốt **`DATABASE_URL` là nguồn cấu hình kết nối duy nhất**. Không hỗ trợ song song `PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD` và không đọc các `DB_*` SQL Server.

```dotenv
NODE_ENV=production
DATABASE_URL=postgresql://app_runtime.<project-ref>:<password>@<pooler-host>:5432/postgres?sslmode=require
CORS_ORIGIN=https://<frontend>.vercel.app
TRUST_PROXY=1
```

- Secret chỉ nhập vào Render/Supabase dashboard; `.env` bị gitignore.
- URL/password không được xuất vào log hay error response.
- Có thể giữ biến pool/timeout riêng, nhưng tên, mặc định và giới hạn phải được test/document; không tạo một nguồn credential thứ hai.
- Script quản trị dùng `MIGRATION_DATABASE_URL`, không được để app runtime fallback sang URL quản trị.
- Production thiếu/sai URL, tắt TLS hoặc không kết nối được phải fail trước khi listen.

### Direct/session/transaction pooler

- **Render (container lâu dài, thường cần IPv4):** dùng Supabase **Session pooler**, cổng `5432`, username dạng `app_runtime.<project-ref>`; host phải copy từ nút **Connect**, không tự đoán.
- **Migration/backup:** ưu tiên Supabase SQL Editor hoặc direct connection; không chạy migration bằng transaction pooler.
- **Transaction pooler `6543`:** không phải cấu hình mặc định cho Render. Chỉ được hỗ trợ sau khi test riêng; query không được phụ thuộc session state, temp table hoặc named prepared statement.
- Supabase tham khảo: [kết nối PostgreSQL](https://supabase.com/docs/guides/database/connecting-to-postgres) và [SSL enforcement](https://supabase.com/docs/guides/platform/ssl-enforcement).

### TLS

- Production luôn mã hóa; tối thiểu `sslmode=require` và bật SSL enforcement trên Supabase.
- Khuyến nghị `verify-full` với CA tải từ Supabase Database Settings khi cách cung cấp CA trên Render đã được cấu hình/test.
- Không dùng `PGSSL_REJECT_UNAUTHORIZED=false` như cách chữa lỗi mặc định mà không ghi rõ mức bảo vệ.

## 4. Schema PostgreSQL đích

Chọn schema backend-only `app` (không đưa vào Exposed Schemas của Supabase), gồm:

| Đối tượng | Khóa/ràng buộc bắt buộc |
|---|---|
| `app.categories` | `category_key varchar(50)` PK; label bắt buộc; ảnh là `/images/...` hoặc null |
| `app.products` | `product_id integer` PK; FK category; price ≥ 0; old_price null hoặc > price; rating 0–5; sold ≥ 0; badge null/hot/sale/new |
| `app.product_images` | PK `(product_id, sort_order)`; FK cascade; sort_order > 0; URL `/images/...` |
| `app.product_specs` | PK `(product_id, sort_order)`; FK cascade; sort_order > 0 |
| `app.promo_codes` | code PK, normalized uppercase; rate `(0,1]`; active boolean |
| `app.orders` | bigint identity PK; `order_code` unique + regex `^DI[0-9]{8}$`; delivery/payment check; phone regex `^0[0-9]{9}$`; amounts không âm; total generated; `timestamptz` |
| `app.order_items` | bigint identity PK; FK order cascade + product; qty 1–99; unit_price ≥ 0; line_total generated; unique `(order_id, product_id)` |

Index tối thiểu: products(category), products(sold DESC), orders(created_at DESC), partial orders(promo_code) khi khác null, order_items(order_id), order_items(product_id).

`unaccent` phải được cài trong schema extension được kiểm soát và gọi có schema qualification; tìm kiếm vẫn bind parameter và tương đương tìm không dấu/case-insensitive.

Hai view đọc thủ công có thể giữ (`vw_san_pham`, `vw_don_hang_chi_tiet`) trong `app`, nhưng không cấp quyền cho Data API roles.

## 5. Phân quyền Supabase

- Tạo login riêng `app_runtime` ngoài repo; password nhập trực tiếp, không hardcode trong SQL/version control.
- Runtime role chỉ có `CONNECT`, `USAGE app`, `SELECT` catalog và `EXECUTE` hàm tạo đơn; không có quyền DDL/drop và không DML trực tiếp orders.
- Hàm tạo đơn dùng `SECURITY DEFINER`, `SET search_path = ''`, mọi table/function đều schema-qualified; revoke execute khỏi `PUBLIC`, `anon`, `authenticated`, chỉ grant cho runtime role.
- Revoke quyền trên schema/tables/views/sequences khỏi `PUBLIC`, `anon`, `authenticated`; backend không dùng anon key/service-role key.
- Nếu BE giữ bảng ở `public` thay vì quyết định `app`, bắt buộc enable RLS và không tạo policy public; đây chỉ là phương án dự phòng, không phải thiết kế ưu tiên.

## 6. Migration và seed an toàn

1. Thay script destructive bằng migration đánh số (`001_...sql`, `002_...sql`).
2. Runner giữ bảng `app.schema_migrations` với version + checksum, dùng advisory lock, chạy mỗi file trong transaction và từ chối file đã áp nhưng checksum đổi.
3. App startup/Docker CMD/Render deploy **không tự migrate hoặc seed**.
4. Trước cutover: export/backup SQL Server local; lưu ngoài repo. Chạy trên Supabase mới/staging trước.
5. Seed catalog đọc `server/data/products.json`, validate toàn bộ trước transaction, bind parameter, chạy lại không nhân bản và mặc định không ghi đè dữ liệu đã sửa tay.
6. Bộ fixture hiện có phải tạo đúng **6 categories, 21 products, 1 product image, 84 specs** và 2 promo code.
7. Đơn lịch sử không seed mặc định. Import phải giữ `order_id`, `order_code`, timestamp, customer, totals, promo và snapshot item; sau import đồng bộ identity sequence.
8. Import lịch sử chạy transaction; lỗi/count lệch rollback toàn bộ. Không log PII/credential.
9. Đối soát trước cutover: count từng bảng, danh sách ID/order code thiếu-dư, tổng `subtotal/discount/shipping/total`, orphan FK = 0, duplicate item/order = 0.
10. Chỉ chuyển Render sang URL Supabase sau khi schema + dữ liệu + smoke staging đều pass. Rollback là trả URL backend về SQL Server chỉ trước khi có đơn mới trên PostgreSQL; sau cutover không dual-write nên phải dừng ghi và có kế hoạch phục hồi riêng.

`schema.sql` có DROP chỉ được giữ với tên rõ là reset-dev và phải yêu cầu cờ xác nhận; tuyệt đối không là lệnh `db:setup` mặc định.

## 7. Hàm giao dịch tạo đơn tương đương

Thay `dbo.usp_TaoDonHang`/TVP bằng `app.fn_tao_don_hang(..., p_items jsonb)`:

1. Kiểm tra name ≥ 2, phone đúng 10 số bắt đầu 0, address ≥ 10, delivery `standard|express`, payment `cod|transfer`.
2. Items phải là JSON array không rỗng; id là integer dương; qty integer 1–99. JSON sai kiểu/cast phải thành lỗi nghiệp vụ `P0001`, không thành 503.
3. Gộp id trùng; tổng qty sau gộp ≤ 99; tối đa 50 sản phẩm khác nhau. Controller vẫn giữ contract hiện tại: raw array > 50 trả 400 validation trước DB.
4. Tất cả sản phẩm phải tồn tại; lock theo product_id tăng dần để lấy giá DB nhất quán và giảm deadlock.
5. Standard 30.000đ, miễn phí khi subtotal ≥ 500.000đ; express luôn 45.000đ.
6. Promo uppercase/trim; chỉ code active mới giảm `round(subtotal * rate)`; code sai/tắt → promo null, discount 0, không lỗi.
7. Insert order + items + response trong cùng transaction của một statement PostgreSQL; không dùng session temp table.
8. Mã `DI` + 8 chữ số; unique collision phải bắt `unique_violation` và retry atomically tối đa 20 lần.
9. Item lưu snapshot name/price; response items sắp theo thứ tự ổn định.
10. Business error `P0001` → HTTP 400 message tiếng Việt; lỗi kết nối/timeout/quyền/schema → 503 chung, không lộ SQL/secret.

## 8. Hợp đồng REST giữ nguyên

- `GET /api/health`: 200 với `ok:true`, `database:"connected"`; DB unavailable → 503/no-store.
- `GET /api/categories`: mảng `{key,label,image}`.
- `GET /api/products?cat&q&sort`: shape product hiện tại; sort mặc định sold desc, hỗ trợ price asc/desc và rating; input luôn bind.
- `GET /api/products/:id`: `{product,related}` hoặc 404 `{error:"Không tìm thấy sản phẩm"}`.
- `POST /api/orders`: body và response `{order:{code,items,delivery,payment,promoCode,subtotal,shippingFee,discount,total,customer,createdAt}}` không đổi; thành công 201.
- `POST /api/chat`, ảnh `/images/*`, cache/CORS/rate limit không đổi.

## 9. Backward compatibility và phạm vi

- **Có:** HTTP/API/FE, đường dẫn ảnh, ID/business rules/dữ liệu.
- **Không:** biến `DB_*`, driver `mssql`/`msnodesqlv8`, TVP/procedure SQL Server, khả năng chạy đồng thời hai DB.
- **BE sửa:** `server/**` gồm dependency/lock, db config, models, migrations/seed/import, tests và docs.
- **FE bỏ qua:** không đổi `client/**`.
- **Ngoài phạm vi chưa được duyệt:** `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`. Tester phải ghi chúng vẫn là SQL Server legacy; chủ repo duyệt task CI riêng trước khi coi pipeline production hoàn tất.
- File SQL Server legacy có thể giữ để audit/import nhưng phải nằm ngoài runtime và ghi rõ không chạy.

## 10. Edge cases bắt buộc test

- URL thiếu/sai protocol, password có ký tự reserved chưa encode, DNS/SSL/timeout, pool exhausted, DB resume chậm trên free tier.
- Query pool phát lỗi sau lúc startup: readiness chuyển false; request trả 503; reconnect thành công thì health phục hồi.
- `q` có dấu/không dấu/ký tự `%_`/Unicode và chuỗi injection; kết quả đúng, không nối SQL.
- JSON item null/object/string, id/qty decimal/NaN/overflow, duplicate cộng >99, 51 item, product bị xóa đồng thời.
- Promo có khoảng trắng/chữ thường/tắt; subtotal đúng 500.000; express ở trên ngưỡng.
- Hai request sinh cùng order code; lỗi insert item phải rollback order.
- Seed/migration chạy hai lần; import count lệch; sequence sau import.

## 11. Acceptance criteria (Given/When/Then)

1. **Given** repo sạch secret, **When** cài dependency, **Then** runtime chỉ có `pg`, không require `mssql/msnodesqlv8`.
2. **Given** thiếu/sai `DATABASE_URL`, **When** start production, **Then** thoát code 1 trước listen và log không chứa URL/password/stack.
3. **Given** migration đã áp một lần, **When** chạy lại, **Then** không drop data/nhân bản; checksum sai bị chặn rõ ràng.
4. **Given** seed fixture chạy hai lần, **Then** số dòng vẫn là 6/21/1/84 và dữ liệu sửa tay không bị ghi đè ngoài chế độ sync tường minh.
5. **Given** Supabase staging + runtime role, **When** gọi catalog/health, **Then** JSON/status đúng contract; anon/authenticated không đọc/ghi được qua Data API.
6. **Given** mọi trường hợp mục 7, **When** POST order, **Then** tổng tiền, promo, snapshot, rollback và lỗi 400/503 đúng.
7. **Given** hai request va order code, **When** chạy đồng thời, **Then** cả hai không tạo order trùng/orphan; retry hoặc lỗi nghiệp vụ xác định.
8. **Given** database thật có dữ liệu legacy, **When** import staging, **Then** đối soát count/ID/order code/tổng tiền khớp và orphan/duplicate bằng 0.
9. **Given** Render dùng session pooler + TLS, **When** deploy Docker, **Then** app bind `0.0.0.0:$PORT`, không migrate khi boot và `/api/health` healthy.
10. **Given** lỗi DB runtime, **When** gọi API, **Then** 503/no-store, response/log không lộ PII/SQL/secret.
11. **Given** code hoàn tất, **When** chạy `npm test` và `npm run verify`, **Then** toàn bộ pass; thêm integration test PostgreSQL thật cho migration/function, không chỉ mock.
12. **Given** workflow GitHub chưa được duyệt sửa, **When** QA bàn giao, **Then** báo rõ CI/deploy SQL Server legacy là hạng mục còn lại, không tuyên bố pipeline production hoàn tất.

## 12. Tài liệu và bằng chứng bàn giao BE

- Danh sách file sửa/tạo và lý do.
- Kết quả `npm test`; request/response mẫu cho health, catalog, order.
- Kết quả migration + seed trên PostgreSQL staging không chứa secret/PII; bảng đối soát dữ liệu.
- Câu lệnh quyền kiểm chứng runtime role được SELECT catalog + EXECUTE function nhưng bị từ chối DDL/DML trực tiếp.
- Hướng dẫn Supabase Connect → Session pooler, Render env, SSL, migration và rollback.
- Không commit/push/deploy, không chạm database thật nếu chủ repo chưa yêu cầu riêng.

