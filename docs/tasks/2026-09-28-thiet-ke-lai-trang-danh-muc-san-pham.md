# Task: Thiết kế lại trang danh mục sản phẩm `/san-pham` theo cấu trúc catalogue chuyên ngành

## Mục tiêu và bối cảnh

- **Loại task:** thuần Frontend. Không đổi API, schema dữ liệu, route, dependency hoặc dữ liệu runtime; bỏ qua giai đoạn Backend.
- **Mục tiêu:** thay đổi đúng trang danh mục `/san-pham` thành catalogue dễ quét và có mật độ sản phẩm cao, thay vì tiếp tục làm trang chi tiết `/product/:id`.
- **Tham chiếu:** chỉ lấy cảm hứng về cấu trúc thương mại từ `https://thegioitramhuong.net/` và các ảnh đã chụp tại `tools/artifacts/reference-category-desktop-v2.png`, `reference-home-desktop-v2.png`, `reference-home-mobile-v2.png`: banner ngang, dải tin cậy 3 mục, sidebar danh mục desktop, hàng tiêu đề/kết quả/sắp xếp, lưới bốn cột và nhịp card gọn. Không sao chép logo, tên, chữ, hình ảnh, palette đặc trưng, chính sách, mã nguồn hay bất kỳ tài sản nào của website tham chiếu.
- **Bản sắc bắt buộc:** duy trì thương hiệu, nội dung có căn cứ và dữ liệu hiện có của **Đồ Cũ Quang Huy**; dùng token trong `client/docs/DESIGN.md` (nền kem ấm, olive là tương tác chính, graphite-olive là CTA tối phụ, đất nung chỉ cho giảm giá). Không đổi header/footer hoặc các route khác.
- **Hiện trạng cần giữ:** `Products.jsx` đã lấy `products`, `categories`, `loading`, `error`, `reload` từ `CatalogContext`; tìm kiếm/lọc/sắp xếp được phản ánh trong URL bằng `q`, `cat`, `sort`; card tiếp tục dùng `ProductCard` với link chi tiết, thêm giỏ và lưu sản phẩm.

## User story

Là khách đang xem hàng thanh lý, tôi muốn thấy nhanh các nhóm hàng, số kết quả và nhiều sản phẩm trong một nhịp catalogue rõ ràng, để thu hẹp lựa chọn theo danh mục/từ khóa/giá mà vẫn mở chi tiết, lưu hoặc thêm đúng món vào giỏ ngay từ danh sách.

## Hướng thiết kế và cấu trúc layout

### Desktop

1. Giữ breadcrumb ở đầu trang. Thay page hero cũ bằng **banner/hero ngang toàn bề rộng content**: nền/ảnh có thể dùng duy nhất asset catalogue đã có qua helper hiện hữu, lớp phủ tonal bảo đảm chữ đọc được, eyebrow nhỏ, H1 “Sản phẩm”/nội dung mô tả đúng giọng thương hiệu hiện có. Banner là điểm mở đầu ngắn gọn, không là carousel, không dùng hình/copy tham chiếu và không tạo lời hứa mới.
2. Ngay dưới banner là **trust strip ba mục** theo một hàng: dùng icon cùng hệ và chỉ tái dùng các thông tin/copy có căn cứ đang có trên Home (hỏi rõ tình trạng, xem hàng trước khi chốt, hỏi cách nhận hàng). Mỗi mục là thông tin phụ trợ, không biến thành CTA cạnh tranh với catalogue.
3. Khối catalogue desktop chia hai cột: sidebar danh mục bên trái có tiêu đề, “Tất cả” và danh mục động từ `CatalogContext`; vùng nội dung bên phải là nơi tìm, sắp xếp và xem lưới. Sidebar có thể sticky trong phạm vi catalogue nhưng không che navbar/footer.
4. Chọn danh mục tại sidebar phải có trạng thái active rõ ràng, có thể hiển thị số lượng theo category từ `products`; mỗi mục là button/điều khiển thật, không chỉ là text. Không hardcode sáu nhóm danh mục: render theo `categories` API hiện có.
5. Đầu vùng nội dung là **topbar gọn** gồm nhãn/tên nhóm đang xem ở bên trái, thông tin kết quả ở gần đó và select “Sắp xếp” ở bên phải. Bên dưới đặt ô tìm kiếm cùng bộ chọn danh mục hiện có theo dạng nén; không lặp lại nhiều panel hoặc vùng control có viền dày.
6. Thêm **thanh tiêu đề nhóm** ngay trên lưới, nền olive hoặc nâu/graphite-olive đúng token, chữ tương phản tốt. Nhãn phải phản ánh filter: “Toàn bộ sản phẩm” khi `cat=all`, tên category đang chọn khi hợp lệ; không tự bịa các collection/nhóm dữ liệu mới.
7. Lưới hiển thị bốn cột ở desktop rộng. Trong phạm vi `/san-pham`, card được làm gọn hơn: khoảng cách đều, ảnh là trọng tâm, ít padding/bóng/viền hơn hiện trạng, không làm mất badge/rating/lưu/tên/giá/giảm giá/nút thêm giỏ hoặc click sang chi tiết. Ưu tiên CSS scope của trang để không làm thay đổi ngoài ý muốn Home/Saved.

### Tablet và mobile

1. Ở tablet hẹp, sidebar không còn chiếm cột; danh mục chuyển thành hàng chip cuộn ngang hoặc control tương đương dễ chạm, vẫn dùng chính dữ liệu và cập nhật `cat` như sidebar.
2. Mobile xếp theo thứ tự breadcrumb → banner → trust strip → tìm/lọc → topbar + sort → thanh tiêu đề nhóm → lưới. Trust strip là ba hàng gọn hoặc bố cục không tràn; không ẩn thông tin chỉ vì màn hình nhỏ.
3. Lưới luôn đúng **hai cột trên mobile**, với gutter nhỏ nhưng đủ chạm; nội dung card không đè nhau, tên tối đa hai dòng, giá và nút thêm giỏ vẫn đọc/bấm được. Không quay về một cột trừ trường hợp viewport cực hẹp mà hai cột thực sự không thể duy trì kích thước chạm an toàn.
4. Ở breakpoint mobile, select sắp xếp và tìm kiếm full-width/dễ chạm; không sticky sidebar/topbar che nội dung. Giữ motion chỉ ở hover/focus nhẹ, tắt hoặc giảm theo `prefers-reduced-motion`.

## Luật nghiệp vụ và trường hợp biên

1. **Không đổi hợp đồng API/dữ liệu.** Trang tiếp tục lấy một lần qua `CatalogContext` và không thêm endpoint, request, field, host hardcode hay dependency. Ảnh banner/card chỉ dùng helper và asset backend hiện hữu; không nhúng asset của trang tham chiếu hoặc vào bundle.
2. Giữ nguyên semantics URL: `q` là từ khóa tìm kiếm, `cat` là key danh mục (`all` là mặc định), `sort` có `popular`, `price-asc`, `price-desc`, `rating` (`popular` là mặc định). Khi cập nhật một điều khiển chỉ sửa tham số liên quan; tham số mặc định bị xóa như hiện tại để URL gọn và link chia sẻ/tải lại cho cùng kết quả.
3. Sidebar, select danh mục, chip mobile và ô tìm kiếm phải là các cách điều khiển **cùng một state URL**. Chọn category không tự xóa `q` hay `sort`; bấm tìm nhanh giữ hành vi toggle query hiện có; “Xóa lọc” đặt đồng thời `q=''`, `cat='all'`, `sort='popular'`.
4. Danh mục lạ/đã không còn trong API, query chỉ có khoảng trắng, hoặc tổ hợp lọc không khớp phải cho kết quả rỗng an toàn và hiển thị empty state + nút xóa lọc; không crash, không tự đổi dữ liệu hoặc tạo URL sai. Khi không có `products`, count/topbar/thanh nhóm vẫn đọc được và không chia cho 0.
5. Giữ ba trạng thái tách biệt: loading dùng skeleton bám bố cục catalogue; lỗi hiện copy lỗi + nút “Thử lại” gọi `reload`; dữ liệu tải thành công nhưng không khớp lọc dùng empty state. Không render card giả hoặc trust/banner gây che trạng thái lỗi.
6. `ProductCard` giữ nguyên link `/product/:id`, hành vi thêm giỏ/toast, lưu/bỏ lưu và `aria-pressed`; phần trăm giảm giá chỉ hiện theo xử lý dữ liệu hiện có. Không đổi tên, giá, category, rating, lượt bán, ảnh hay copy sản phẩm.
7. Mọi control có label truy cập được, focus-visible tương phản, thao tác bằng keyboard; sidebar và chip biểu đạt trạng thái bằng `aria-pressed`/ngữ nghĩa thích hợp. Count/kết quả là thông tin text, không chỉ dựa vào màu. Duy trì tối thiểu WCAG AA.

## Phạm vi FE

- Sửa chính `client/src/pages/Products.jsx` và `client/src/pages/Products.css` để tổ chức lại catalogue, cùng CSS scope tối thiểu cho card nếu cần để giảm chrome **chỉ ở `/san-pham`**.
- Có thể import/reuse `Breadcrumbs`, `ProductCard`, `Icon`, `CatalogContext`, `HERO_IMAGE`/`categoryImages` và các token/lớp đã có; không tạo bản sao dữ liệu danh mục hay component card.
- Trước khi thêm style, kiểm tra `client/src/App.css`, `Home.css`, `ProductCard.css` và design system để tái dùng token/breakpoint có sẵn. Không sửa `App.jsx`, `client/src/api/`, `CatalogContext`, `package.json`, Vite, backend hoặc ảnh server.

## Ngoài phạm vi

- Không làm lại `/product/:id`, header, footer, Home, Saved, Cart hay trang quản trị.
- Không thêm phân trang, bộ lọc giá/rating mới, so sánh, quick view, carousel, analytics, CMS, SEO mới, review người dùng hay dữ liệu/chứng nhận/chính sách chưa có.
- Không sao chép nhận diện hoặc tài sản của `thegioitramhuong.net`; không thay thiết kế hệ thống toàn cục chỉ để mô phỏng trang tham chiếu.

## Acceptance criteria (Given / When / Then)

1. **Đúng route và nhận diện**  
   Given viewport desktop, When khách mở `/san-pham`, Then đây là trang catalogue (không phải `/product/:id`) có breadcrumb, banner ngang, trust strip ba mục, sidebar và vùng sản phẩm; toàn bộ logo/tên/copy/asset thuộc Đồ Cũ Quang Huy hoặc repo, không chứa nội dung/tài sản của website tham chiếu.

2. **Sidebar danh mục desktop**  
   Given API trả “Tất cả” và các categories, When catalog đã tải ở desktop, Then sidebar render đủ danh mục động, active `cat` đúng URL, count (nếu hiện) khớp `products`, và chọn một mục chỉ cập nhật `cat` rồi lọc đúng lưới.

3. **Tìm, lọc, sắp xếp và URL**  
   Given khách nhập `q`, chọn category hoặc sort, When thao tác một control, Then query params `q`/`cat`/`sort` tuân thủ quy tắc mặc định, các control đồng bộ với URL, kết quả/lưới/thanh tiêu đề nhóm cập nhật đúng, và reload/chia sẻ URL vẫn giữ kết quả tương ứng.

4. **Topbar và thanh nhóm**  
   Given catalog có hoặc không có filter, When vùng nội dung render, Then topbar hiển thị tên/bối cảnh kết quả + select sắp xếp rõ ràng, và thanh olive/nâu ngay trên grid hiển thị “Toàn bộ sản phẩm” hoặc nhãn danh mục active với tương phản AA.

5. **Mật độ lưới/card desktop**  
   Given có ít nhất bốn sản phẩm và viewport desktop rộng, When danh sách render, Then lưới có bốn cột, khoảng cách đều và card trực quan gọn hơn (ảnh/sản phẩm nổi bật hơn panel chrome), đồng thời mỗi card vẫn mở chi tiết, thêm giỏ, lưu, hiện giá/badge/rating như trước.

6. **Mobile hai cột và điều khiển**  
   Given viewport mobile, When khách mở hoặc lọc `/san-pham`, Then sidebar chuyển thành điều khiển danh mục phù hợp touch, banner/trust/topbar xếp không tràn, sort/search dễ chạm, lưới đúng hai cột, nội dung/nút card không chồng hoặc mất thao tác.

7. **Không có kết quả và lỗi tải**  
   Given `q`/`cat` không khớp, API lỗi, hoặc catalog đang tải, When trang render, Then lần lượt có empty state + xóa lọc, lỗi + “Thử lại” gọi `reload`, hoặc skeleton; không crash, không render dữ liệu giả và URL/filter không bị tự ý mất.

8. **Accessibility và motion**  
   Given người dùng keyboard, screen reader hoặc `prefers-reduced-motion`, When duyệt sidebar/chip/search/sort/card, Then thứ tự focus logic, nhãn và trạng thái active rõ, focus-visible có tương phản, kết quả không chỉ truyền đạt bằng màu, và animation không bắt buộc.

9. **Không hồi quy và build**  
   Given thay đổi FE hoàn tất, When chạy `npm run build` tại gốc repo, Then build pass; route chi tiết, Cart, Saved, Home và API/data hiện có không bị đổi.

## Handoff triển khai

[HANDOFF] analyst -> fe-coder
Task: `docs/tasks/2026-09-28-thiet-ke-lai-trang-danh-muc-san-pham.md` · Status: DONE
Artifacts: mục tiêu đúng route `/san-pham`, hướng cấu trúc desktop/mobile, ràng buộc brand/bản quyền, luật URL/filter/edge case, phạm vi FE và 9 acceptance criteria · Verify: đã đọc `README.md`, `AGENTS.md`, `client/docs/PRODUCT.md`, `client/docs/DESIGN.md`, `Products.jsx/.css`, `ProductCard.jsx/.css`, `CatalogContext`, helper ảnh và ảnh tham chiếu category; không chạy build/test theo vai trò analyst · Next: triển khai chỉ FE, giữ API/URL behavior, chạy `npm run build`, rồi handoff tester chạy `npm run verify` + `npm run smoke`.
