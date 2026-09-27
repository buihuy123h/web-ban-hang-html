# Task: Public flow bài viết đã đăng trên storefront

## Mức độ và liên hệ

- **Severity:** MAJOR — admin CRUD đã lưu được `status = published` nhưng storefront hiện không có public route/API để khách đọc bài.
- **Liên quan:** bổ sung cho `docs/tasks/2026-09-27-admin-quan-ly-cua-hang.md`, không thay đổi hợp đồng CRUD admin hiện có.
- **Mục tiêu:** cung cấp luồng đọc bài viết công khai tối thiểu, dùng đúng bảng `app.admin_posts` và không làm lộ bài nháp.

## Bối cảnh hiện trạng

- Admin đã có `GET/POST/PUT/DELETE /api/admin/posts[/:id]`, các field `title`, `slug`, `excerpt`, `content`, `status`, `image` và trạng thái `draft`/`published`.
- PostgreSQL lưu bảng `app.admin_posts`; `slug` là duy nhất, `image_url` chỉ nhận đường dẫn bắt đầu bằng `/images/`.
- API public hiện chưa có route bài viết; FE cũng chưa có lớp API hoặc route storefront cho bài viết.
- Hệ thống dùng `/api/*` tương đối ở FE, Express MVC ở BE, PostgreSQL/Supabase là nguồn runtime và `client/src/api/` là lớp gọi API duy nhất.

## User story

Là khách truy cập storefront, tôi muốn xem danh sách và chi tiết các bài viết đã được đăng để đọc nội dung hữu ích của cửa hàng; bài nháp hoặc bài đã gỡ đăng không được xuất hiện hay truy cập qua public URL.

## Quyết định hợp đồng public API

### 1. Danh sách bài đã đăng

`GET /api/posts`

Không yêu cầu cookie hoặc đăng nhập admin.

**Query:** không bắt buộc. Bản tối thiểu không hỗ trợ tìm kiếm, phân trang hoặc lọc trạng thái từ client; server luôn áp dụng filter `status = 'published'`.

**Response 200:**

```json
{
  "posts": [
    {
      "id": 12,
      "title": "Cách chọn bàn ghế cũ cho quán ăn",
      "slug": "cach-chon-ban-ghe-cu-cho-quan-an",
      "excerpt": "Một vài điểm cần kiểm tra trước khi chốt.",
      "content": "Nội dung bài viết...",
      "image": "/images/products/post-12.jpg",
      "createdAt": "2026-09-27T08:00:00.000Z",
      "updatedAt": "2026-09-27T08:30:00.000Z"
    }
  ]
}
```

- Trả mảng rỗng hợp lệ khi chưa có bài published: `{ "posts": [] }`.
- Thứ tự cố định: `updatedAt` giảm dần, sau đó `id` giảm dần.
- Response public không trả `status` và không trả các cột DB dạng raw; BE map về camelCase như trên.
- Danh sách được phép chứa `content` để giữ hợp đồng tối thiểu đơn giản; FE có thể chỉ dùng `excerpt` ở card.

### 2. Chi tiết theo slug

`GET /api/posts/:slug`

`slug` là slug công khai, không phải `post_id`.

**Response 200:**

```json
{
  "post": {
    "id": 12,
    "title": "Cách chọn bàn ghế cũ cho quán ăn",
    "slug": "cach-chon-ban-ghe-cu-cho-quan-an",
    "excerpt": "Một vài điểm cần kiểm tra trước khi chốt.",
    "content": "Nội dung bài viết...",
    "image": "/images/products/post-12.jpg",
    "createdAt": "2026-09-27T08:00:00.000Z",
    "updatedAt": "2026-09-27T08:30:00.000Z"
  }
}
```

- Truy vấn bắt buộc đồng thời `slug = :slug AND status = 'published'`.
- Draft, bài đã chuyển về draft, bài đã xóa và slug không tồn tại đều trả cùng `404` để không làm lộ nội dung private.

### Mã lỗi và quy ước chung

- `404`: `{ "error": "Không tìm thấy bài viết." }` cho detail; list không có bài vẫn `200` với mảng rỗng.
- `503`: `{ "error": "Cơ sở dữ liệu tạm thời không sẵn sàng. Vui lòng thử lại sau." }`, `Cache-Control: no-store`, khi repository/DB chưa sẵn sàng; dùng helper lỗi hiện có.
- `400`: chỉ dùng nếu server xác định `slug` sai định dạng trước query: `{ "error": "Slug bài viết không hợp lệ." }`. Slug hợp lệ nhưng không có bài published là `404`.
- Không trả `401` cho endpoint public; không dùng admin cookie để đọc bài.
- Không cho phép ghi ở public path. Ghi vẫn chỉ ở `/api/admin/posts` và qua `requireAdmin`.

## Luật nghiệp vụ và filter bắt buộc

1. Chỉ `status = 'published'` được trả bởi cả hai endpoint.
2. Client không thể truyền query để bỏ qua filter (`?status=draft` không có tác dụng).
3. Runtime đọc PostgreSQL/Supabase qua repository, không fallback `server/data/products.json`.
4. `slug` duy nhất; nếu admin đổi slug, slug cũ trả `404`, list chỉ có slug mới.
5. `content` được coi là text/HTML theo giá trị admin đã lưu; task này không thêm editor, sanitize pipeline hay markdown parser. FE không thực thi HTML không an toàn nếu chưa có cơ chế render an toàn được duyệt.
6. `image` null thì FE dùng fallback/không ảnh; BE không tự tạo URL ảnh.
7. Chỉ dùng cache public hiện có; `503` phải `no-store`, không yêu cầu cache riêng hay SSR/SEO.

## Phạm vi BE

- Thêm public router/controller/repository method theo MVC hiện có và mount trong `server/routes/index.js`.
- Query bind parameter; list/detail đều filter `status` trong query.
- Memory repository/test double có cùng filter với production.
- Bổ sung `node:test`: list chỉ published, list rỗng, detail published, draft/nonexistent cùng 404, DB/repository lỗi trả 503, public không cần cookie.
- Không đổi schema/migration: bảng/cột đã có trong `003_admin_content.sql`.

## Phạm vi FE

- Thêm `client/src/api/posts.js` gọi `GET /posts` và `GET /posts/:slug` qua `request`.
- Thêm storefront `/bai-viet` và `/bai-viet/:slug`, lazy-load trong `App.jsx`.
- Thêm liên kết “Bài viết” vào NavBar/footer nếu cần để khách vào flow; không sửa admin UI ngoài hợp đồng hiện có.
- List dùng `title`, `excerpt`, `image`, `updatedAt`; detail dùng `title`, `content`, `image`, ngày. Có loading, empty và lỗi/thử lại.
- Không dependency mới, không hardcode host, không gọi `/api/admin/posts`, không hiển thị draft.

## Acceptance criteria (Given / When / Then)

1. **Danh sách chỉ published**  
   Given DB có một bài `published` và một bài `draft`, When khách gọi `GET /api/posts`, Then status `200`, response có đúng bài `published`, không có bài `draft`, item đúng schema public.

2. **Danh sách rỗng**  
   Given không có bài `published`, When khách gọi `GET /api/posts`, Then status `200` và body `{ "posts": [] }`, không phải `404`.

3. **Chi tiết published**  
   Given slug trỏ tới bài `published`, When khách mở `/bai-viet/:slug` và FE gọi API, Then API `200` với `{ "post": ... }` và FE hiển thị tiêu đề, nội dung, ảnh/fallback.

4. **Không lộ draft**  
   Given slug trỏ tới bài `draft`, When khách gọi detail hoặc mở URL storefront, Then API `404` cùng thông báo chuẩn; FE không render nội dung draft.

5. **Slug không tồn tại**  
   Given slug không tồn tại, When gọi detail, Then API `404` giống trường hợp draft, không raw SQL error/`500`.

6. **Lỗi DB**  
   Given repository chưa sẵn sàng hoặc query DB thất bại, When gọi public endpoint, Then API `503` body chuẩn, `Cache-Control: no-store`, FE hiển thị lỗi có thể thử lại.

7. **Không cần đăng nhập**  
   Given không có cookie admin, When gọi hai public endpoint, Then request vẫn thành công nếu dữ liệu hợp lệ; endpoint ghi admin vẫn `401`.

8. **Admin publish đến storefront**  
   Given admin tạo/sửa `status = published`, When tải lại list hoặc mở slug, Then bài xuất hiện; khi đổi về `draft` hoặc xóa, public list/detail không còn trả bài.

9. **FE navigation/build**  
   Given storefront chạy, When khách bấm Bài viết, chọn card và quay lại list, Then route đúng, không tải admin UI, không console error; `npm run build` pass.

10. **Regression**  
    Given các route catalog/admin hiện có, When chạy test/build chuẩn, Then không đổi hành vi endpoint hiện hữu và `npm test` pass.

## Ngoài phạm vi

- Không RSS, sitemap, search, category/tag, pagination, view count, bình luận, author, lịch publish, preview draft, SEO SSR, rich-text editor.
- Không đổi tên bảng `admin_posts`, field/status admin CRUD, hay thêm xác thực public.
- Mở rộng ngoài đây phải có task/hợp đồng mới; BE/FE không tự đổi endpoint hoặc response.

## Handoff triển khai

[HANDOFF] analyst -> be-coder
Task: `docs/tasks/2026-09-27-public-posts-storefront.md` · Status: DONE
Artifacts: hợp đồng public API, filter published, lỗi, acceptance criteria, phạm vi BE/FE · Verify: đã đối chiếu task admin, routes/controllers/models/migration và lớp API/router FE; không chạy build/test theo vai trò analyst · Next: BE triển khai API + test theo hợp đồng; sau đó FE triển khai storefront và build.

[HANDOFF] analyst -> fe-coder
Task: `docs/tasks/2026-09-27-public-posts-storefront.md` · Status: DONE
Artifacts: route `/bai-viet`, `/bai-viet/:slug`, lớp `client/src/api/posts.js`, trạng thái UI và response contract · Verify: đã đối chiếu App.jsx, NavBar, API client và trang hiện có; không sửa production code · Next: chờ BE bàn giao API pass test rồi triển khai FE.
