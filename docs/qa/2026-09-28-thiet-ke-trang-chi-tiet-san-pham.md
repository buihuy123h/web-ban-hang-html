# QA: Thiết kế trang chi tiết sản phẩm

- Task: `docs/tasks/2026-09-28-thiet-ke-trang-chi-tiet-san-pham.md`.
- Ngày: 28/09/2026. Vai trò: tester. Kết quả: **PASS trong môi trường local/fixture**, với giới hạn tài nguyên Google bên ngoài được ghi rõ bên dưới.
- Không sửa production code, API, dữ liệu runtime, dependency hoặc các thay đổi có sẵn của chủ repo. Giai đoạn Backend bỏ qua vì task thuần FE.

## Môi trường và lệnh kiểm chứng

- Windows, Chromium headless/Playwright; bản production `client/dist` mới build.
- Server kiểm thử tại `http://localhost:3100`, khởi chạy bằng `$env:NODE_ENV='test'; node -e "require('./server/app').startServer(3100)"`. Catalog/đơn hàng dùng memory fixture; smoke không ghi đơn vào Supabase.
- `npm.cmd run verify`: **81/81 backend test PASS**, Vite build và Brotli/Gzip precompress PASS.
- `node tools/scripts/check-product-detail.cjs`: **17/17 kiểm tra PASS**.
- `$env:BASE='http://localhost:3100'; $env:SMOKE_OFFLINE='1'; npm.cmd run smoke`: **15/15 PASS**, exit 0. Kiểm các route hiện có và luồng thêm giỏ, đặt hàng, quantity, mobile.
- Desktop 1440×1000; mobile 390×844 và 320×844; tablet 768×844. Kiểm thêm desktop thấp 1440×800: panel trở về `position: static`.

## Đối chiếu acceptance criteria

| AC | Kết quả | Bằng chứng |
|---|---|---|
| 1. Desktop/nhận diện | PASS | Gallery và panel cùng hàng; breadcrumb có `aria-current=page`; giữ nội dung/nhận diện sẵn có, token Earth; không có nội dung website tham chiếu. Đã xem ảnh desktop. |
| 2. Điểm mua | PASS | Thứ tự category → H1 → meta → giá → mô tả → specs → quantity/CTA → lưu. Tên/mô tả/specs khớp fixture; giảm giá hợp lệ hiển thị; giá cũ thiếu hoặc thấp hơn giá mới được ẩn. |
| 3. Gallery nhiều ảnh | PASS | Intercept catalog chỉ trong browser để có 2 ảnh hợp lệ và 1 URL trùng. Click/Enter đổi đúng ảnh; `aria-pressed`, focus visible và loại thumbnail trùng đạt; không lỗi app. |
| 4. Gallery thiếu/lỗi | PASS | Product 18 không gallery, product 19 có 1 ảnh: không có thumbnail giả. Ảnh JPEG không decode được chuyển sang fallback danh mục; ảnh chính có `naturalWidth>0`; CTA vẫn hoạt động. |
| 5. Giỏ/lưu/quantity | PASS | Quantity 1→3→1; nút giảm disabled tại 1. CTA có tổng 2.550.000đ ở product 19, qty 3; localStorage giỏ đúng product/qty, toast xuất hiện; lưu/bỏ lưu đổi chữ và `aria-pressed`. |
| 6. Chuyển id | PASS | Từ product 19 với qty=2, ảnh thứ 2, click related product 20 qua SPA: qty trở về 1, ảnh đầu/thumbnail đầu được chọn. |
| 7. Hậu mãi/related | PASS | Hai disclosure mở/đóng bằng click, Enter, Space; copy giữ nguyên qua diff. Related product 19 là 21 và 20, cùng category, không chứa chính nó; catalog chỉ 1 product thì related ẩn. Mã giới hạn `.slice(0,4)` giữ nguyên. |
| 8. Responsive/accessibility | PASS | `scrollWidth` bằng viewport ở 320/390/768/1440px; một cột trên tablet/mobile, panel static; nút quantity 46×46px, CTA cao 56px. Tab tới CTA có outline 2px; thumbnail keyboard đạt; text contrast đo 5,68–12,65:1. Reduced motion: transition 0,01ms, không animation bắt buộc. Header không che đầu product stage; panel kết thúc trong stage. |
| 9. Trạng thái catalog | PASS | Delay response thấy skeleton và `aria-busy`; response 503 mô phỏng thấy lỗi/Thử lại, retry về product; id 999999 thấy not-found và link `/san-pham`; các trạng thái không có `.detail-grid`. |
| 10. Hồi quy/build | PASS | Gate 81/81 + build đạt; smoke 15/15 trong chế độ offline minh bạch; diff task không đổi route, API hoặc dependency. |

## Artifacts

- `tools/scripts/check-product-detail.cjs`: phép kiểm có thể chạy lại, intercept chỉ trong context trình duyệt cho các trường hợp biên.
- `tools/artifacts/product-detail-checks.json`: kết quả chi tiết, kích thước/contrast/focus và request font bị môi trường chặn.
- `tools/artifacts/product-detail-desktop.png`: full-page product 19, viewport 1440×1000.
- `tools/artifacts/product-detail-mobile.png`: full-page product 19, viewport 390×844.
- `tools/artifacts/shot-*.png`: ảnh các route từ smoke. Artifacts được gitignore; đã cuộn quét và đợi reveal trước khi chụp ảnh product detail.

## Giới hạn môi trường và sửa phép thử

Lần smoke đầu ở sandbox trả exit 1: script thử click nút giảm quantity đang disabled đúng quy tắc, cùng lỗi `ERR_NETWORK_ACCESS_DENIED` từ Google Fonts/Google Maps. Các luồng giỏ/đơn hàng vẫn chạy thành công. Tester sửa vòng smoke để bỏ thao tác click nút disabled (check quantity riêng vẫn kiểm đúng trạng thái) và thêm `SMOKE_OFFLINE=1` chỉ phân loại lỗi mạng bị từ chối ở đúng hai host tài nguyên ngoài. Chế độ smoke mặc định vẫn bắt các lỗi này; lỗi app/same-origin không được bỏ qua. Lần chạy cuối ghi rõ 33 request tài nguyên ngoài bị chặn và đạt 15/15 check chức năng.

Google Fonts/Maps cần kiểm lại khi có quyền truy cập mạng; ảnh local đang dùng font fallback. Không có console/page error của app trên catalog hợp lệ; lỗi 503 cố ý tạo trong case retry là phản hồi mô phỏng. Không thay dữ liệu ảnh có sẵn dù fixture có ảnh minh họa khác tên món đồ. Đây không phải phép kiểm dữ liệu Supabase hoặc triển khai production.

[HANDOFF] tester -> owner
Task: `docs/tasks/2026-09-28-thiet-ke-trang-chi-tiet-san-pham.md` · Status: DONE
Artifacts: QA report này, `tools/scripts/check-product-detail.cjs`, sửa phép thử `tools/scripts/smoke.js`, ảnh/JSON trong `tools/artifacts/` · Verify: `npm.cmd run verify` → 81/81 + build PASS; Playwright → 17/17 PASS; smoke offline → 15/15 PASS · Next: chủ repo xem ảnh và kiểm tài nguyên Google khi có mạng; không commit/push/deploy.
