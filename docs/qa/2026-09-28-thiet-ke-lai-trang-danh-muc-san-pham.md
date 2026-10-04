# QA: Thiết kế lại trang danh mục sản phẩm

- Task: `docs/tasks/2026-09-28-thiet-ke-lai-trang-danh-muc-san-pham.md`.
- Kiểm ngày 29/09/2026, vai trò tester. Kết quả: **PASS local/fixture**; giới hạn Google Fonts/Maps ghi bên dưới.
- Backend bỏ qua: task thuần FE. QA không sửa production, API, dữ liệu runtime, dependency hoặc các thay đổi có sẵn của chủ repo.

## Lệnh và môi trường

- Chromium headless qua Playwright, bản production build mới tại `http://localhost:3100`, server fixture do owner khởi chạy; catalog và đơn hàng kiểm thử dùng memory, không ghi Supabase.
- `npm.cmd run verify`: **81/81 PASS**, Vite build và precompress Brotli/Gzip PASS, exit 0.
- `node tools/scripts/check-products-catalog.cjs`: **13/13 PASS**, exit 0.
- `$env:BASE='http://localhost:3100'; $env:SMOKE_OFFLINE='1'; npm.cmd run smoke`: **15/15 PASS**, exit 0; route Home, Products, Detail, Saved, About, Contact, Cart và luồng thêm giỏ/đặt hàng hoạt động.
- Viewport: desktop 1440×1000, tablet 768×844, mobile 390×844, hẹp 320×844.

## Acceptance criteria

| AC | Kết quả | Kiểm chứng |
|---|---|---|
| 1. Route/nhận diện | PASS | `/san-pham` có breadcrumb current page, H1 “Sản phẩm”, banner rộng 1344px, dải ba thông tin tin cậy, sidebar và catalogue; asset banner `/images/catalog/noi-chao.jpg` trong repo, không có nội dung website tham chiếu. Đã xem ảnh final. |
| 2. Sidebar động | PASS | 7 mục gồm Tất cả và 6 danh mục API; mỗi count khớp fixture 21 sản phẩm. Chọn `luu-tru` cập nhật riêng `cat`, giữ `q=inox` và `sort=price-asc`; sidebar active/`aria-pressed`, select và thanh nhóm đồng bộ. Intercept browser bổ sung danh mục API mới: render được, count 0 và empty state đúng. |
| 3. Search/filter/sort/URL | PASS | Kiểm cả popular, price-asc, price-desc, rating; đối chiếu thứ tự giá/rating/lượt bán. Query/category/sort giữ đúng URL khi reload. Giá kho lưu trữ giảm dần 850.000→150.000→100.000, tăng dần đảo lại đúng. Các tham số mặc định bị bỏ; quick term toggle chỉ đổi `q` và giữ `cat`/`sort`; Xóa lọc đặt cả ba về mặc định. |
| 4. Topbar/thanh nhóm | PASS | Có kết quả `21 / 21 sản phẩm`, nhãn toàn bộ/category active và thanh olive. Hai select sort trong DOM nhưng **chỉ một visible** theo breakpoint; label truy cập “Sắp xếp”. Tương phản chữ thanh nhóm đo **5,68:1**, đạt AA. |
| 5. Desktop/card | PASS | Desktop grid bốn cột, ảnh/badge/rating/giá/giá cũ/discount hiện; card gọn, không viền/bóng panel. Link mở đúng `/product/:id`; thêm giỏ đúng id/qty=1, hiện toast; lưu/bỏ lưu đổi `aria-pressed`. Dữ liệu vẫn từ CatalogContext/ProductCard. |
| 6. Mobile/control | PASS | 390/320px đúng hai cột, 768px ba cột; sidebar ẩn và select danh mục vẫn thao tác được. `scrollWidth` bằng viewport ở mọi kích thước; tất cả card không tràn. Bản compact cuối: search wrapper, sort và quick chips cao 44px; search full-width, sort nằm cùng hàng kết quả; save 44×44px, CTA cao 44px. Tên card clamp hai dòng trên link. Category/sort/add trên mobile đều chạy. Card đầu y=598,45px. |
| 7. Trạng thái/empty/retry | PASS | Unknown cat, query chỉ khoảng trắng và query không khớp đều empty an toàn; cả Xóa lọc và Xem tất cả trả đủ catalogue. API delay có skeleton/aria-busy và không card giả. API 503 mô phỏng có lỗi/Thử lại; retry giữ `cat=luu-tru&sort=rating` và trả 3 card. Catalog rỗng hiển thị `0 / 0 sản phẩm`, không crash. |
| 8. Accessibility/motion | PASS | Sidebar và quick term có trạng thái aria-pressed; Enter chọn category. Search label, category label và sort label dùng được; Tab từ search tới select và nút tìm đúng thứ tự. Focus outline 2px; text/kết quả không chỉ dựa màu. Reduced motion: card không animation, transition CTA chỉ 0,01ms. |
| 9. Build/hồi quy | PASS | Gate 81/81 + build PASS; smoke 15/15 kiểm các route và luồng cart/order. Diff task không đổi API, dependency, routes, CatalogContext hay dữ liệu backend; CSS mới scope `.products-page`. |

## Bằng chứng

- `tools/scripts/check-products-catalog.cjs`: script QA chạy lại được; các intercept chỉ tồn tại trong browser context để thử lỗi/danh mục mới/empty catalog.
- `tools/artifacts/products-catalog-checks.json`: 13 kết quả, kích thước grid/control và lỗi font ngoại vi được phân loại.
- `tools/artifacts/products-catalog-desktop.png`: full-page desktop 1440×1000.
- `tools/artifacts/products-catalog-mobile.png`: full-page mobile 390×844.
- `tools/artifacts/products-catalog-mobile-compact.png`, `products-catalog-mobile-compact-320.png`: ảnh bản compact 390/320px, đã xem và chụp lại theo bản cuối giữ quick chips 44px.
- `tools/artifacts/products-catalog-mobile-top.png`, `products-catalog-mobile-cards.png`: ảnh viewport để kiểm chi tiết control/card mobile. Đã xem các ảnh; ảnh full-page đã quét scroll và đợi reveal.

## Giới hạn và hiệu chỉnh oracle

Google Fonts và Google Maps bị sandbox trả `ERR_NETWORK_ACCESS_DENIED`. Smoke với `SMOKE_OFFLINE=1` ghi riêng 33 request bị chặn ở đúng hai tài nguyên ngoài này; chế độ mặc định vẫn bắt lỗi mạng, lỗi app/same-origin không được bỏ qua. Ảnh QA dùng font fallback; cần kiểm tài nguyên Google khi có mạng. Không thấy console/page error của app trên catalogue hợp lệ. Phản hồi 503 trong kiểm retry là lỗi chủ động mô phỏng.

Lần đầu của script QA mới tạo có hai selector sai: `[aria-current=page]` trùng navbar/breadcrumb hợp lệ và line-clamp kiểm nhầm H3 thay vì link `.p-name a`. Tester sửa oracle để scope breadcrumb và đọc đúng phần tử text; chạy lại toàn bộ đạt 13/13. Không sửa code production, không làm yếu tiêu chí, không sửa smoke thêm trong task này.

## Kiểm lại bản mobile compact

Sau FE sửa mật độ mobile trong `Products.css` và nâng quick chips lên 44px, chạy lại `node tools/scripts/check-products-catalog.cjs`: **13/13 PASS**, exit 0. Bổ sung assertion quick chips mobile >=44px để bắt hồi quy vùng chạm. Các case URL/category/sort/reload/empty/retry/card/focus/reduced-motion vẫn đạt; desktop/tablet giữ nguyên. Không chạy lại gate/smoke vì thay đổi chỉ khoảng cách/CSS mobile, FE đã build artifact mới; gate/smoke trước đó vẫn là kết quả tương ứng bản trước tinh chỉnh này.

Ở cả 390×844 và 320×844, card đầu bắt đầu tại **y=598,45px** thay **y=723,52px**, sớm hơn khoảng **125px**. Bản compact đầu từng đạt y=588,45px nhưng quick chips chỉ 34px; bản cuối thêm 10px để bảo toàn vùng chạm. Lưới hai cột; `scrollWidth` lần lượt 390/320px, không card overflow. Search wrapper, select category, nút tìm, sort, quick chips và CTA cao 44px; save 44×44px. Canonical `products-catalog-mobile.png` và JSON đã chụp/cập nhật theo bản compact cuối; ảnh mobile top/cards cũng cập nhật.

**MINOR vùng chạm đã được FE sửa và QA xác nhận:** ở context `isMobile=true, hasTouch=true`, `pointer:coarse=true`, cả bốn quick chips cao 44px. Card đầu y=598,45px, không overflow. Input riêng cao 42px bên trong wrapper label 44px có thể click để focus. QA không sửa production.

[HANDOFF] tester -> owner
Task: `docs/tasks/2026-09-28-thiet-ke-lai-trang-danh-muc-san-pham.md` · Status: DONE
Artifacts: QA report này, `tools/scripts/check-products-catalog.cjs`, ảnh/JSON trong `tools/artifacts/` · Verify: `npm.cmd run verify` → 81/81 + build PASS; catalogue Playwright → 13/13 PASS; smoke offline → 15/15 PASS · Next: chủ repo xem ảnh, kiểm tài nguyên Google khi có mạng; không commit/push/deploy.
