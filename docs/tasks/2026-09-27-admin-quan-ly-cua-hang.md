# Task: Admin quản lý cửa hàng

## Mục tiêu

Thêm khu vực quản trị riêng cho chủ shop Đồ Cũ Quang Huy. Admin đăng nhập bằng một tài khoản cấu hình qua biến môi trường, sau đó quản lý sản phẩm, bài viết, đơn hàng và thông tin cửa hàng.

## Phạm vi

- Một tài khoản admin duy nhất (`ADMIN_USERNAME`, `ADMIN_PASSWORD`).
- Phiên đăng nhập bằng token cookie `HttpOnly`, không lưu mật khẩu ở client.
- CRUD sản phẩm.
- CRUD bài viết và trạng thái `draft`/`published`.
- Xem danh sách/chi tiết đơn hàng và cập nhật trạng thái.
- Đọc/cập nhật thông tin cửa hàng.
- Không bao gồm phân quyền nhiều user, thanh toán online. Ảnh sản phẩm hỗ trợ tải trực tiếp qua admin, lưu file trong `server/public/images/products/` và chỉ lưu đường dẫn `/images/...` trong DB.

## Hợp đồng API

- `POST /api/admin/login` body `{ username, password }` → `{ admin: { username } }`; sai thông tin → `401`.
- `POST /api/admin/logout` → `204`.
- `GET /api/admin/me` → `{ admin: { username } }`; chưa đăng nhập → `401`.
- `GET /api/admin/products` → `{ products }`.
- `POST /api/admin/products` body product fields → `{ product }`; `400` nếu thiếu/sai dữ liệu.
- `PUT /api/admin/products/:id` body product fields → `{ product }`.
- `DELETE /api/admin/products/:id` → `204`.
- `POST /api/admin/upload` body `{ dataUrl }` → `{ image: "/images/products/<filename>" }`; chỉ nhận JPG/PNG/WEBP/GIF tối đa 5 MB, yêu cầu phiên admin.
- `GET /api/admin/posts` → `{ posts }`; `POST/PUT/DELETE /api/admin/posts[/:id]` CRUD.
- `GET /api/admin/orders` → `{ orders }`; `GET /api/admin/orders/:id` → `{ order }`.
- `PATCH /api/admin/orders/:id/status` body `{ status }` → `{ order }`.
- `GET /api/admin/store` → `{ store }`; `PUT /api/admin/store` body store fields → `{ store }`.

## Luật nghiệp vụ

- API admin không trả dữ liệu nếu thiếu cookie phiên hợp lệ.
- Session hết hạn hoặc logout phải yêu cầu đăng nhập lại.
- Sản phẩm phải có tên, danh mục, giá không âm, mô tả; xóa sản phẩm đang có trong đơn phải bị chặn.
- Bài viết phải có tiêu đề và nội dung; slug duy nhất; chỉ bài `published` mới hiển thị công khai.
- Trạng thái đơn: `new`, `confirmed`, `shipping`, `completed`, `cancelled`.
- Chỉ cho phép chuyển trạng thái về một trong các giá trị trên.

## Acceptance criteria

1. Given chưa đăng nhập, When mở `/admin`, Then thấy màn hình đăng nhập và không thấy dữ liệu quản trị.
2. Given thông tin đúng, When đăng nhập, Then vào dashboard và gọi được API admin.
3. Given thông tin sai, When đăng nhập, Then nhận lỗi rõ ràng và không tạo phiên.
4. Given admin, When thêm/sửa/xóa sản phẩm, Then danh sách quản trị và catalog cập nhật tương ứng.
5. Given admin, When quản lý bài viết, Then có thể lưu nháp hoặc đăng bài.
6. Given admin, When mở đơn hàng, Then thấy thông tin khách, sản phẩm, tổng tiền và trạng thái; cập nhật trạng thái thành công.
7. Given admin, When sửa thông tin cửa hàng, Then dữ liệu được lưu và đọc lại đúng.
8. Given chưa đăng nhập, When gọi bất kỳ endpoint admin nào, Then nhận `401`.