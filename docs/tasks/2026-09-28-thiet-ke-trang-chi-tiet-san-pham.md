# Task: Thiết kế lại trang chi tiết sản phẩm theo cảm hứng bố cục thương mại chuyên ngành

## Mục tiêu và bối cảnh

- **Loại task:** thuần Frontend. Không đổi API, schema dữ liệu, route hay dependency; bỏ qua giai đoạn Backend.
- **Mục tiêu:** làm mới `/product/:id` thành trang chi tiết có cấu trúc bán hàng chuyên nghiệp, ưu tiên ảnh, thông tin ra quyết định và hành động mua rõ ràng trên desktop lẫn mobile.
- **Tham chiếu:** lấy cảm hứng ở **cấp độ bố cục và nhịp thông tin** từ `https://thegioitramhuong.net`: khu vực sản phẩm trọng tâm gồm gallery, thông tin mua cô đọng và các khối cam kết/thông tin sau đó. Không sao chép logo, tên thương hiệu, hình ảnh, câu chữ, nội dung chính sách, mã nguồn hoặc nhận diện độc quyền của website tham chiếu.
- **Bản sắc bắt buộc:** giữ thương hiệu, giọng văn và dữ liệu hiện có của **Đồ Inox Gia Đình**. Kế thừa đầy đủ hệ thiết kế `Editorial Circular Commerce — Earth Edition` trong `client/docs/DESIGN.md`: nền kem ấm, olive cho tương tác/chủ đạo, graphite-olive cho CTA tối phụ, đất nung chỉ dành cho giảm giá, chữ tiếng Việt, bo góc và bóng ấm hiện có.
- **Hiện trạng cần kế thừa:** `ProductDetail.jsx` đã có breadcrumbs; gallery; giá, rating, lượt bán, tồn hàng; mô tả/spec; số lượng; thêm giỏ; lưu; cam kết/giao hàng; disclosure; related products; cùng trạng thái loading, error, not-found. Thiết kế lại không được làm mất các luồng này.

## User story

Là người mua đang cân nhắc một món đồ inox gia dụng, tôi muốn nhìn nhanh ảnh, giá, tình trạng, đặc điểm và phương án mua ngay tại trang chi tiết, để tự tin thêm đúng số lượng vào giỏ hoặc lưu lại mà không phải dò tìm thông tin hay rời khỏi trang.

## Hướng thiết kế và cấu trúc trải nghiệm

### Thứ bậc desktop

1. Giữ breadcrumb ở đầu trang để quay về danh mục; tên sản phẩm hiện tại phải là trang hiện hành cho screen reader.
2. Tạo một **product stage** rõ ràng: gallery bên trái chiếm vai trò thị giác chính; bên phải là khu vực quyết định mua. Gallery có ảnh lớn, dải thumbnail chọn ảnh và badge giảm giá nếu dữ liệu có `oldPrice`.
3. Khu vực mua hiển thị theo thứ tự: category → H1 → rating/lượt bán/trạng thái còn hàng → giá hiện tại, giá cũ và mức giảm (nếu có) → mô tả ngắn → specs → chọn số lượng + CTA thêm giỏ → lưu sản phẩm. Giá và CTA là hai điểm nhấn, không cạnh tranh bởi màu khuyến mãi.
4. Đặt các bằng chứng giảm lo ngại (cam kết, giao hàng, tình trạng/bảo quản, đổi trả/bảo hành) sau hành động mua trong các khối/accordion dễ quét. Chỉ dùng đúng copy hiện có; không tự bổ sung cam kết, chứng nhận, số liệu hay chính sách mới.
5. Giữ phần sản phẩm liên quan phía dưới, dùng `ProductCard` hiện có và chỉ render khi có dữ liệu.

### Responsive và tương tác

- Desktop có thể giữ panel thông tin mua sticky khi còn ở trong product stage; không để sticky che header hoặc giữ người dùng ở một panel sau khi đã qua vùng chi tiết.
- Từ breakpoint tablet/mobile, chuyển về một cột theo thứ tự gallery → thông tin → mua → cam kết/disclosure → liên quan; bỏ sticky. CTA thêm giỏ full-width/dễ chạm và các nút số lượng không chật hoặc tràn.
- Thumbnail phải là button có tên truy cập được, trạng thái chọn bằng `aria-pressed`, focus nhìn rõ và có thể thao tác hoàn toàn bằng bàn phím. Ảnh thumbnail chỉ là trang trí (`alt=""`); ảnh chính mang `alt` là tên sản phẩm.
- Chọn thumbnail cập nhật ảnh chính và trạng thái chọn. Không tạo nhãn “góc ảnh” gây hiểu nhầm nếu dữ liệu chỉ có một ảnh thực; nếu gallery không đủ ảnh phân biệt thì có thể ẩn/giảm dải thumbnail, còn ảnh chính vẫn hiển thị qua helper/fallback hiện có.
- Motion chỉ là hover/focus nhẹ, không làm cản trở đọc/mua; phải theo `prefers-reduced-motion`. Không thêm carousel tự chạy, popup che nội dung hoặc hiệu ứng làm thay đổi hành vi mua.

## Luật nghiệp vụ và trường hợp biên

1. **Hợp đồng dữ liệu/API không đổi.** Tiếp tục lấy dữ liệu qua `CatalogContext`; không thêm request, endpoint, field, host hardcode hoặc dependency. Ảnh tiếp tục đi qua `getProductGallery`, `getViewImage`, `getProductPosition`, `categoryImages` và `handleImgError` trong `client/src/data/productImages.js`.
2. Product hợp lệ giữ toàn bộ hành vi hiện hữu: `addToCart(product, qty)`, toast xác nhận, `toggleSaved(product.id)`, trạng thái `aria-pressed` của lưu, và card liên quan cùng category (tối đa 4) không gồm chính sản phẩm.
3. Số lượng luôn là số nguyên tối thiểu `1`; nút giảm không được hạ thấp hơn `1`. Khi `id` thay đổi trong cùng component, phải trả `qty` về `1` và ảnh đang chọn về ảnh đầu để không mang trạng thái từ sản phẩm trước sang sản phẩm khác.
4. `oldPrice` không có thì không render giá gạch, badge giảm giá hoặc vùng copy giảm giá. Không để phép tính tạo `NaN`, phần trăm âm hay thông tin giảm giá sai.
5. Gallery rỗng, ảnh lỗi hoặc chỉ có ảnh fallback vẫn phải giữ được ảnh chính có fallback an toàn; không render ảnh hỏng, thumbnail lặp vô nghĩa hoặc lỗi console. Nếu có nhiều ảnh, thumbnail phải khớp đúng ảnh được chọn.
6. Giữ riêng ba trạng thái hiện có: skeleton khi catalog đang tải; lỗi có nút thử lại gọi `reload`; sản phẩm không tồn tại có link quay về trang sản phẩm. Các trạng thái này phải đọc được, không bị layout product stage áp vào.
7. Không thay đổi dữ liệu minh họa, tên sản phẩm, giá, mô tả, specs, rating, lượt bán, category hay copy thương hiệu. Không dùng tài sản/copy của website tham chiếu; chỉ sử dụng asset backend và nội dung trong repo.
8. Bảo đảm tương phản tối thiểu WCAG AA, focus rõ, HTML semantics hợp lệ; tôn trọng reduced motion. Dùng token/design system hiện có thay vì thêm bảng màu, font hay framework mới.

## Phạm vi FE

- Sửa `client/src/pages/ProductDetail.jsx` và `client/src/pages/ProductDetail.css` để tái cấu trúc và định kiểu trang chi tiết. Có thể sửa CSS/component frontend phụ trợ **chỉ khi cần thiết** để đạt accessibility hoặc tái sử dụng đúng hệ thống hiện có; không sửa API/data/backend.
- Tái sử dụng `Breadcrumbs`, `ProductCard`, `Icon`, `formatPrice`, `CartContext`, `CatalogContext` và helpers ảnh hiện tại; không tạo bản sao component hoặc nhúng ảnh vào bundle.
- Kiểm tra các token/lớp dùng chung trong `client/src/App.css` trước khi thêm CSS mới. CSS phải được scope vào trang chi tiết, không làm vỡ thẻ sản phẩm, header, cart hay các route khác.
- Không thay `App.jsx` route, không thay `client/src/api/`, không đổi `package.json`, config Vite hoặc design system tổng thể.

## Ngoài phạm vi

- Không thay đổi API/backend/DB, dữ liệu catalog, ảnh trong `server/public/images/`, schema gallery hoặc thuật toán đề xuất liên quan.
- Không thêm tab nội dung mới cần dữ liệu chưa có, đánh giá người dùng, video, zoom/lightbox, chat riêng, thanh toán trực tiếp, coupon, so sánh, analytics hay SEO mới.
- Không sao chép nhận diện, thương hiệu, nội dung hoặc tài sản của `thegioitramhuong.net`; không redesign header/footer hay những trang không phải product detail.

## Acceptance criteria (Given / When / Then)

1. **Bố cục và nhận diện desktop**  
   Given một product hợp lệ và viewport desktop, When khách mở `/product/:id`, Then breadcrumb, gallery, panel thông tin/mua, khối tin cậy và related products có thứ bậc như hướng thiết kế; giao diện dùng đúng ngôn ngữ/tokens Đồ Inox Gia Đình và không chứa logo, tên, copy hay asset của website tham chiếu.

2. **Điểm quyết định mua dễ quét**  
   Given product có giá, mô tả, specs và tồn hàng, When trang được render, Then tên, category, rating/lượt bán/tồn hàng, giá, specs, quantity picker và CTA “Thêm vào giỏ” hiện theo thứ tự quy định; giá/CTA nổi bật còn accent giảm giá chỉ xuất hiện khi dữ liệu giảm giá hợp lệ.

3. **Gallery nhiều ảnh**  
   Given product có ít nhất hai ảnh gallery hợp lệ, When khách bấm hoặc dùng bàn phím chọn một thumbnail, Then ảnh chính đổi đúng ảnh tương ứng, thumbnail cập nhật trạng thái chọn/focus truy cập được và không có lỗi console.

4. **Gallery thiếu ảnh hoặc ảnh lỗi**  
   Given product không có gallery, chỉ có một ảnh, hoặc một URL ảnh tải lỗi, When trang render hay ảnh lỗi, Then ảnh chính vẫn có fallback qua helper hiện có, không có thumbnail/nhãn góc ảnh lặp gây hiểu nhầm và trang vẫn thao tác mua được.

5. **Thêm giỏ, lưu và quantity**  
   Given product hợp lệ, When khách tăng/giảm quantity, thêm vào giỏ rồi bấm lưu/bỏ lưu, Then quantity không dưới `1`, số tiền CTA phản ánh quantity, giỏ/toast hoạt động như trước và nút lưu phản ánh đúng trạng thái bằng chữ lẫn `aria-pressed`.

6. **Điều hướng giữa sản phẩm**  
   Given khách đang xem một product với quantity hoặc thumbnail đã thay đổi, When điều hướng sang `/product/:id` khác mà page component vẫn còn mount, Then quantity trở về `1` và gallery bắt đầu ở ảnh đầu của sản phẩm mới.

7. **Nội dung hậu mãi và related**  
   Given product có disclosure và có/không có item cùng category, When khách cuộn qua khu vực mua, Then các disclosure hiện đúng copy hiện có và mở/đóng được bằng bàn phím; related chỉ hiện khi có dữ liệu, tối đa bốn item, không gồm product đang xem.

8. **Mobile và accessibility**  
   Given viewport tablet hoặc mobile và người dùng touch/keyboard/reduced motion, When mở trang và thao tác điều khiển, Then layout là một cột không bị tràn/chồng header, panel không sticky, CTA/nút lượng dễ chạm, thứ tự đọc logic, focus rõ và không có animation bắt buộc.

9. **Các trạng thái catalog**  
   Given catalog đang loading, trả lỗi, hoặc không có id product, When mở URL chi tiết, Then vẫn lần lượt hiện skeleton, thông báo lỗi kèm “Thử lại”, hoặc empty state có link quay lại; không render product stage bằng dữ liệu thiếu.

10. **Không hồi quy và build**  
    Given thay đổi FE hoàn tất, When chạy `npm run build` ở gốc repo, Then build pass; các route/catalog/cart/saved hiện có vẫn hoạt động và không có thay đổi API hay dependency.

## Handoff triển khai

[HANDOFF] analyst -> fe-coder
Task: `docs/tasks/2026-09-28-thiet-ke-trang-chi-tiet-san-pham.md` · Status: DONE
Artifacts: mục tiêu, hướng bố cục, ràng buộc bản quyền/thương hiệu, luật nghiệp vụ/edge cases, phạm vi FE và 10 acceptance criteria · Verify: đã đọc `README.md`, `AGENTS.md`, `client/docs/PRODUCT.md`, `client/docs/DESIGN.md`, `ProductDetail.jsx`, `ProductDetail.css`, component/helper liên quan; không chạy build/test theo vai trò analyst · Next: triển khai chỉ trong FE, chạy `npm run build`, rồi handoff tester kiểm `npm run verify` + `npm run smoke`.
