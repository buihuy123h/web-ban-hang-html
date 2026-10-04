# Task: Thay mới giao diện frontend theo Stitch Marketplace

## 1. Mục tiêu và bối cảnh

- **Loại task:** thuần Frontend. Chỉ sửa `client/**` khi triển khai; Backend không tham gia. Không đổi API, schema, database, route URL, dependency, dữ liệu runtime hoặc cấu hình build.
- **Mục tiêu:** thay lớp trình bày hiện tại bằng storefront marketplace tuyển chọn, ấm và giàu tính biên tập theo bộ Stitch tại `stitch_secondhand_home_goods_marketplace/`, nhưng vẫn là Đồ Inox Gia Đình/Đồ Cũ Quang Huy, tiếng Việt và giữ nguyên toàn bộ luồng mua sắm hiện có.
- **Nguồn tham chiếu:** bốn screen/code HTML trong `stitch_secondhand_home_goods_marketplace/stitch_secondhand_home_goods_marketplace/` (trang chủ, danh mục, chi tiết, dịch vụ) và `warm_earthy_japandi_editorial/DESIGN.md`. Chỉ tham khảo bố cục hero/editorial, bento, gallery, card, filter và CTA; không sao chép code HTML/Tailwind, asset, logo, URL ảnh ngoài, tên thương hiệu, copy, giá, cam kết hoặc chính sách Stitch.
- **Nền tảng bắt buộc:** React 18 + Vite 5 + React Router 6; kế thừa token và accessibility trong `client/docs/DESIGN.md`; gọi dữ liệu chỉ qua `client/src/api/`; ảnh chỉ qua `client/src/data/productImages.js` và `/images/...`; không thêm CDN/framework/dependency.
- **Route và hành vi phải giữ:** `/`, `/san-pham`, `/product/:id`, `/cart`, `/saved`, `/about`, `/contact`, route không tồn tại; header/footer, giỏ và saved trong localStorage, tìm/lọc/sắp xếp, form liên hệ, chatbot và đặt hàng.

## 2. User story

Là người mua đồ gia dụng/đồ inox tại Việt Nam, tôi muốn storefront có cảm giác marketplace tuyển chọn, dễ quét trên điện thoại và desktop, để tìm theo danh mục, hiểu thông tin/giá/tình trạng từ dữ liệu thật, xem chi tiết, lưu hoặc thêm vào giỏ và đặt hàng mà không mất dữ liệu hay phải học lại cách dùng.

## 3. Định hướng UI theo Stitch và DESIGN

1. **Shell:** canvas kem ấm, surface trắng/tonal, hairline và chữ tương phản cao; navbar rõ trên desktop, dock/menu gọn trên mobile; badge cart/saved có trạng thái và label accessible.
2. **Trang chủ `/`:** hero editorial/bento tĩnh, headline tiếng Việt có căn cứ, search console và danh mục là CTA chính; category/product render từ API; trust/story/CTA chỉ dùng nội dung đã có; không carousel tự chạy, không thông tin bịa.
3. **Danh mục `/san-pham`:** page hero ngắn, trust strip, bộ lọc tìm kiếm–danh mục–sắp xếp và lưới card; đồng bộ `q`, `cat`, `sort`; desktop sidebar/filter panel, mobile control dễ chạm.
4. **Chi tiết `/product/:id`:** product stage/gallery, breadcrumb, thông tin mua, giá/giảm/rating/tồn kho/specs theo dữ liệu; quantity, thêm giỏ, lưu, disclosure và related. Không bịa condition inspector, review, chứng nhận hay bảo hành.
5. **Cart/checkout:** áp dụng visual system mới nhưng giữ tăng/giảm/xóa, mã `QUANGHUY10`, delivery/payment, validate và gửi đơn; không thêm cổng thanh toán hoặc bước nghiệp vụ.
6. **About/Contact/Saved/NotFound:** dùng cùng shell/token, giữ nội dung, hành vi và route hiện có.
7. **Responsive/accessibility:** mobile-first, không tràn ngang; keyboard, focus-visible, label/ARIA, WCAG AA và `prefers-reduced-motion`.

## 4. Luật nghiệp vụ và trường hợp biên

- Không hardcode sản phẩm, danh mục, giá, tồn kho, related hoặc kết quả chat. Loading dùng skeleton; lỗi có tiếng Việt và retry; rỗng có empty state cùng hành động quay lại/xóa lọc.
- Deep-link/refresh không 404. `q`, `cat`, `sort` giữ sau reload/chia sẻ; `cat=all`, `sort=popular` là mặc định và không tự thêm query không cần thiết.
- UI chỉ gửi `items: [{id, qty}]`, `delivery`, `payment`, `promoCode`, `customer`; không dùng giá client để tính hay ghi đè tổng, vì backend tính lại.
- Submit đơn phải chống gửi lặp. Thành công hiển thị mã đơn; `400` hiển thị lỗi field nếu có; `429/5xx` có thông báo thân thiện; thất bại không làm mất giỏ.
- Ảnh chỉ qua helper hiện có; lỗi/thiếu dùng fallback, alt có nghĩa; không base64 và không ảnh ngoài repo.
- Chat gửi đúng `messages`, hiển thị `reply` và sản phẩm gợi ý; fallback, `400`, `429`, `5xx` không crash và không mất nội dung chưa gửi.
- ProductCard vẫn mở detail, thêm giỏ, lưu; badge/count cập nhật; localStorage tương thích dữ liệu cũ.
- UI/tài liệu tiếng Việt; không tự thêm tuyên bố giảm giá, bảo hành, đổi trả, condition, chứng nhận hoặc số liệu.

## 5. Hợp đồng API — giữ nguyên, không sửa BE

FE chỉ gọi qua `client/src/api/`, không đổi path/field/query.

| Method/path | Request/query | Thành công | Lỗi cần xử lý |
|---|---|---|---|
| `GET /api/categories` | Không body | Mảng category `{key, label}` | Loading/error catalog + retry |
| `GET /api/products?cat=&q=&sort=` | Query hiện có; bỏ query mặc định `all/popular` như lớp API hiện tại | Mảng product | Error state, không dữ liệu giả |
| `GET /api/products/:id` | `id` số dương | `{product, related}` | `404 {error}` → not-found; lỗi khác → retry |
| `POST /api/orders` | `{items:[{id,qty}],delivery:'standard'|'express',payment:'cod'|'transfer',promoCode:'QUANGHUY10'|'',customer:{name,phone,address,note}}` | HTTP `201`, `{order}`; hiển thị `order.code` và không tin tổng client | `400 {error,fields?}`, `429`, `5xx`; giữ giỏ |
| `POST /api/chat` | `{messages:[{role:'user'|'assistant',content:string}]}` | `{reply,mode:'ai'|'fallback',products:[{id,name,price}]}` | `400`, `429`, `5xx`; thông báo tiếng Việt |

Giữ nguyên validate server: tối đa 50 item, quantity 1–99, tên tối thiểu 2 ký tự, phone 10 số bắt đầu `0`, địa chỉ tối thiểu 10 ký tự; server tính lại giá. Không đổi `/images/...` hoặc cấu trúc product. `GET /api/health` chỉ health-check, không dùng thay catalog.

## 6. Phạm vi triển khai

### Trong phạm vi (FE)

- Tái cấu trúc JSX/CSS/component trong `client/src/` cho storefront public theo Stitch + `DESIGN.md`.
- Tái sử dụng/điều chỉnh `NavBar`, `Footer`, `ProductCard`, `Toast`, `ContactFab`, icon và context; thêm component trình bày khi cần nhưng không thêm thư viện.
- Responsive desktop/tablet/mobile; loading/error/empty; accessibility, reduced motion, focus và keyboard.
- Giữ lazy-load route trong `App.jsx`, gọi API qua lớp sẵn có, ảnh qua helper sẵn có.

### Ngoài phạm vi

- Không sửa `server/**`, database, REST API, middleware, JSON contract, ảnh server, CI/CD, `package.json` hoặc cấu hình build.
- Không đổi route, field/query, localStorage, rule giá/ship/payment/promo, rate limit hay xác thực backend.
- Không tích hợp thanh toán thật, CMS, admin, review/rating mới, phân trang, so sánh, wishlist server, analytics/SEO mới, upload ảnh hay chatbot provider mới.
- Không sao chép asset/code/copy/nhận diện Stitch; không gọi URL ngoài hoặc hardcode `http://localhost:3000`.

## 7. Acceptance criteria (Given / When / Then)

1. **Shell và nhận diện**  
   **Given** khách mở route public hợp lệ trên desktop, tablet hoặc mobile, **When** giao diện tải xong, **Then** shell theo Stitch + DESIGN nhất quán, tiếng Việt, dùng asset trong repo, không copy/brand ngoài repo và không có lỗi console nghiêm trọng.

2. **Trang chủ marketplace**  
   **Given** `/api/categories` và `/api/products` trả dữ liệu, **When** mở `/`, **Then** hero/editorial, search, danh mục và sản phẩm render từ dữ liệu thật; click đi đúng route; loading/lỗi có state tương ứng và không bịa dữ liệu.

3. **Danh mục và URL filter**  
   **Given** khách ở `/san-pham`, **When** nhập `q`, chọn `cat` hoặc `sort`, **Then** control, URL và lưới đồng bộ qua lớp API hiện có; giá trị được giữ khi refresh/chia sẻ; desktop/mobile không tràn.

4. **Card và ảnh**  
   **Given** catalog có item hoặc ảnh item lỗi, **When** card hiển thị, **Then** giữ tên/ảnh/giá/giảm giá/rating/lưu/thêm giỏ/link detail theo dữ liệu; ảnh fallback; alt, focus và keyboard hợp lệ.

5. **Chi tiết sản phẩm**  
   **Given** `GET /api/products/:id` trả product hợp lệ, **When** mở detail, **Then** gallery, breadcrumb, thông tin mua, giá, specs, quantity, thêm giỏ, lưu, disclosure và related đúng thứ bậc; thiếu/404/error có state an toàn và link điều hướng.

6. **Giỏ và đặt hàng**  
   **Given** giỏ có item, **When** khách thay quantity, delivery/payment, promo hoặc customer rồi submit, **Then** UI validate, gửi đúng payload `POST /api/orders`, chống submit lặp, hiển thị `order.code` khi thành công và giữ giỏ khi thất bại; không tự tính/ghi đè giá server.

7. **Saved, contact và chat**  
   **Given** khách thao tác lưu, form liên hệ hoặc chat, **When** thực hiện, **Then** state/localStorage, validate, thông báo và API chat hoạt động như hiện tại; lỗi `400/429/5xx` không crash và không mất nội dung chưa gửi.

8. **Responsive và accessibility**  
   **Given** viewport 320px, tablet, desktop cùng keyboard và reduced-motion, **When** duyệt catalog → detail → cart, **Then** không overflow/chồng, target chạm đủ dùng, focus/label/ARIA/state rõ, tương phản AA và animation giảm/tắt đúng preference.

9. **Không đổi API và hồi quy**  
   **Given** thay đổi FE hoàn tất, **When** kiểm tra Network và route cũ, **Then** chỉ endpoint/field đã nêu được sử dụng, không có request backend mới; Home, Products, Detail, Cart, Saved, About, Contact, NotFound và deep-link refresh vẫn hoạt động.

10. **Build/verify**  
    **Given** FE triển khai xong, **When** chạy `npm run build`, `npm run verify` từ gốc repo (và `npm run smoke` khi server chạy), **Then** build/verify pass, không thêm dependency và QA đối chiếu được từng tiêu chí.

## 8. Handoff triển khai

[HANDOFF] analyst -> fe-coder
Task: `docs/tasks/2026-10-04-thay-moi-giao-dien-stitch-marketplace.md` · Status: DONE
Artifacts: task spec tiếng Việt đã hoàn thiện với mục tiêu/bối cảnh, user story, tham chiếu Stitch cụ thể, định hướng UI, luật nghiệp vụ/edge cases, hợp đồng API giữ nguyên, phạm vi và 10 acceptance criteria Given/When/Then · Verify: đã đọc `README.md`, `AGENTS.md`, `client/README.md`, `client/docs/DESIGN.md`, `client/docs/PRODUCT.md`, các API/context FE hiện có, `server/docs/DATABASE.md` và toàn bộ reference Stitch (screen/code HTML + DESIGN); không chạy build/test vì analyst không sửa code · Next: fe-coder triển khai chỉ trong `client/**`, không đổi API/dependency; chạy `npm run build`, rồi handoff tester chạy `npm run verify` + `npm run smoke`.
