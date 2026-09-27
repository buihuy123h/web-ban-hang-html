# QA report retest: Admin quản lý cửa hàng và public posts

**Ngày kiểm thử:** 2026-09-27  
**Phạm vi:** retest sau khi BE/FE sửa hai bug; đối chiếu `docs/tasks/2026-09-27-admin-quan-ly-cua-hang.md` và `docs/tasks/2026-09-27-public-posts-storefront.md`.  
**Kết luận:** **PASS cho API/contract và build; BLOCKED cho smoke UI do thiếu runtime DB/server.**

## Tóm tắt retest

Hai regression chính đã được kiểm tra bằng HTTP in-process, không sửa production:

- Public posts: `GET /api/posts` chỉ trả bài published; `GET /api/posts/:slug` trả đúng schema, draft/slug không tồn tại cùng `404`; luồng admin publish → public đọc được → chuyển draft thì bị ẩn.
- Admin delete: tạo đơn chứa sản phẩm rồi gọi `DELETE /api/admin/products/:id` trả `409` đúng thông báo và sản phẩm vẫn tồn tại.
- Auth: endpoint admin không cookie trả `401`; public posts không yêu cầu cookie.

## Lệnh và kết quả

| Lệnh | Kết quả |
|---|---|
| `npm test` | **PASS — 74/74** |
| `npm run build` | **PASS — Vite build thành công, precompress tạo 40 bản nén** |
| `npm run verify` | **PASS — 74/74 + build thành công** |
| `git diff --check` | **PASS** (chỉ cảnh báo LF/CRLF hiện hữu) |
| `npm run smoke` | **BLOCKED — timeout 30 giây**; môi trường không có server/DB runtime được cấu hình, không có smoke artifact |

Test mới tại `server/test/admin.test.js` bao phủ HTTP in-process cho hai regression và auth/public boundary. `server/test/posts.test.js` bao phủ contract list/detail, draft, 404 và 503/no-store.

## Đối chiếu acceptance criteria — admin

| # | Kết quả | Evidence |
|---:|---|---|
| 1 | **PASS API / UI chưa smoke** | Route admin có login; middleware chặn dữ liệu khi thiếu cookie. Browser chưa chạy do smoke blocked. |
| 2 | **PASS** | Login in-process thành công và gọi endpoint admin bằng cookie trong `admin.test.js`. |
| 3 | **PASS** | Cookie/session chỉ được cấp với credentials đúng; request không cookie nhận `401`. |
| 4 | **PASS cho delete rule** | Sản phẩm đã có trong đơn bị chặn `409`; memory + SQL repository test pass. CRUD catalog đã có regression hiện hữu; chưa xác nhận DB thật. |
| 5 | **PASS API** | Admin publish được public endpoint đọc; draft không xuất hiện/không truy cập được. FE build pass, browser chưa smoke. |
| 6 | **PASS một phần** | Repository/controller cho list/detail/status pass test hiện hữu; chưa test DB PostgreSQL thật hoặc browser. |
| 7 | **PASS một phần** | Wiring store có test hiện hữu; chưa xác nhận persistence PostgreSQL thật. |
| 8 | **PASS** | Admin route không cookie trả `401`; public posts không yêu cầu đăng nhập. |

## Đối chiếu acceptance criteria — public posts

| # | Kết quả | Evidence |
|---:|---|---|
| 1 | **PASS** | List chỉ dùng `status=published`, không trả `status`, map camelCase đúng contract. |
| 2 | **PASS** | List rỗng trả `200 {"posts":[]}`. |
| 3 | **PASS API; UI blocked** | Detail published trả `{ post }`; FE route `/bai-viet/:slug` đã build. |
| 4 | **PASS** | Draft detail trả cùng `404 {"error":"Không tìm thấy bài viết."}`. |
| 5 | **PASS** | Slug không tồn tại trả cùng `404`, không lộ lỗi SQL. |
| 6 | **PASS** | Repository error/unready trả `503`, body chuẩn và `Cache-Control: no-store`. |
| 7 | **PASS** | Public request không cookie thành công; admin request không cookie `401`. |
| 8 | **PASS in-process** | Admin publish → public visible; update về draft → public `404`. Xóa chưa chạy trong cùng test nhưng repository filter đúng. |
| 9 | **PASS build; UI blocked** | `npm run build` pass, route/chunk Posts sinh thành công; chưa có browser artifact. |
| 10 | **PASS** | `npm test` 74/74 và `npm run verify` pass. |

## Hạn chế môi trường / handoff

`npm run smoke` đã được chạy đúng lệnh chuẩn nhưng timeout sau 30 giây. Đây là **BLOCKED môi trường**, không phải bug sản phẩm: smoke script cần storefront server tại `localhost:3000`; server production cần PostgreSQL/Supabase runtime, hiện workspace không cung cấp cấu hình DB QA. Vì vậy chưa xác nhận được thao tác browser, console error, navigation và ảnh artifact.

Khuyến nghị handoff: chạy lại `npm run smoke` trên môi trường QA cô lập đã có `DATABASE_URL`, migration/seed và server đang listen; sau đó bổ sung artifact vào báo cáo. Không có bug production mới được mở từ retest này.

[HANDOFF] tester -> chủ repo  
Task: `docs/tasks/2026-09-27-admin-quan-ly-cua-hang.md` + `docs/tasks/2026-09-27-public-posts-storefront.md` · Status: DONE (API/build) / BLOCKED (UI smoke môi trường)  
Artifacts: `server/test/admin.test.js`, `docs/qa/2026-09-27-admin-quan-ly-cua-hang.md` · Verify: `npm test` → 74/74 pass; `npm run build` → PASS; `npm run verify` → PASS; `npm run smoke` → timeout 30s, không artifact  
Next: cung cấp DB/server QA rồi chạy lại smoke UI; không cần sửa production theo kết quả retest hiện tại.

## Ghi chú an toàn

QA chỉ thêm/cập nhật test trong `server/test/**` và báo cáo trong `docs/qa/**`; không sửa production code.
