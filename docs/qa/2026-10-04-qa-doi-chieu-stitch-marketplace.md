# QA: Đối chiếu UI Stitch Marketplace — cập nhật theo source hiện tại

- **Ngày cập nhật:** 2026-10-04
- **Task:** `docs/tasks/2026-10-04-thay-moi-giao-dien-stitch-marketplace.md`
- **Phạm vi:** `/`, `/san-pham`, `/product/:id`; đối chiếu reference `stitch_secondhand_home_goods_marketplace/`.
- **Vai trò:** QA; không sửa production code.
- **Git:** working tree có nhiều thay đổi chưa commit; QA chỉ đọc/đối chiếu.

## Verify commands

| Lệnh | Kết quả hiện tại | Evidence |
|---|---|---|
| `npm run verify` | **PASS** | `npm test`: 81 pass, 0 fail; build Vite 82 modules + precompress 40 file. |
| `npm run smoke` | **NOT VERIFIED / TIMEOUT** | `qa-smoke-latest.log` không hoàn tất trong giới hạn runner 30 giây; lần chạy trước chỉ PASS Home rồi timeout. |
| Health `GET http://localhost:3000/api/health` | **NOT VERIFIED** | Command timeout; lần trước có `EADDRINUSE` trên port 3000. |
| Browser visual desktop/mobile | **NOT VERIFIED** | Chưa có run mới hoàn tất ở 1440/390/320px. |

## Kiểm tra lại hai BUG MAJOR cũ

### BUG cũ 1 — Home hardcode category: ĐÃ HẾT theo source

- `client/src/pages/Home.jsx:84-91`: `categorySections` tạo từ `categories`, lọc `all`, nhóm product theo `category.key`.
- `client/src/pages/Home.jsx:252-275`: category tiles map trực tiếp `categories`, dùng `category.label`, `category.key`, `category.image` và count từ `products`.
- Không còn `const categoryTiles = [...]` hardcode trong Home.

**Kết luận:** **CLOSED / PASS source review**. Runtime loading/error vẫn cần smoke/browser.

### BUG cũ 2 — `/products/...` ảnh trả 404: ĐÃ ĐƯỢC XỬ LÝ theo source

- `client/src/data/productImages.js:23-31`: `resolveImg('/products/x')` chuyển thành `/images/products/x`; dạng không slash cũng được chuẩn hóa.
- `client/src/data/productImages.js:62-75`: `getProductImage/getViewImage` dùng resolver.
- `client/src/data/productImages.js:92-101`: `handleImgError` fallback nhiều tầng rồi placeholder.
- `client/src/pages/Home.jsx:254-266`: category image resolve và có `onError` fallback.
- Backend verify pass các test ảnh tồn tại/404 thật.

**Kết luận:** **CLOSED / PASS source + test review**. Chưa có Network browser run mới xác nhận product id cũ tải 200; không mở lại bug chỉ dựa log cũ.

## Đối chiếu acceptance criteria

- **AC1 Shell/nhận diện:** NOT VERIFIED — chưa có visual browser run cuối.
- **AC2 Home marketplace:** PASS source / NOT VERIFIED runtime — dùng categories, products, categorySections.
- **AC3 Catalog/filter URL:** NOT VERIFIED — cần kiểm tra q/cat/sort và reload.
- **AC4 Card/ảnh/fallback:** PASS source + verify — resolver và fallback đã có; cần Network run.
- **AC5 Detail/gallery:** NOT VERIFIED — chưa smoke hoàn tất detail.
- **AC6 Cart/checkout:** NOT VERIFIED — chưa browser run submit/order.
- **AC7 Saved/contact/chat:** NOT VERIFIED — chưa browser run đầy đủ error states.
- **AC8 Responsive/accessibility:** NOT VERIFIED — chưa đo 1440/390/320px, keyboard, focus, reduced-motion.
- **AC9 API/route regression:** PASS backend tests; NOT VERIFIED full browser.
- **AC10 Build/verify:** PASS — `npm run verify` pass.

## Gate còn lại

[BUG] 2026-10-04-thay-moi-giao-dien-stitch-marketplace · Severity: MINOR  
Where: Smoke gate / toàn bộ public routes · Steps: 1) chạy `npm run smoke`; 2) chờ tool hoàn tất.  
Expected: Smoke kết thúc với exit code rõ ràng và artifact cho Home, catalog, detail, cart.  
Actual: Runner timeout sau 30 giây; health port 3000 chưa xác nhận ổn định.  
Evidence: `qa-smoke-latest.log` không có kết quả hoàn tất; command timeout.  
Assign to: tester

Đây là gate môi trường/kiểm thử, chưa quy kết thêm lỗi production UI.

## Acceptance criteria bổ sung cho re-test

1. `npm run smoke` hoàn tất <=120 giây khi server sẵn sàng, có exit code/artifact.
2. Network xác nhận ảnh dùng `/images/products/...` trả 200 hoặc fallback hợp lệ, không request `/products/...` trực tiếp.
3. Viewport 1440x900, 390x844, 320px không overflow; `scrollWidth <= innerWidth`.
4. Catalog q/cat/sort giữ đúng URL sau reload; active/count khớp API.
5. Detail gallery, quantity, add-to-cart, saved, disclosure, related pass mouse + keyboard.

## Kết luận

**QA: CONDITIONAL PASS / CHƯA ĐỦ DONE.** Hai BUG MAJOR đã hết theo source hiện tại và `npm run verify` PASS (81/81 tests, build thành công). Smoke timeout và các gate visual/runtime responsive, accessibility, detail/cart còn chưa verify.

[HANDOFF] tester -> fe-coder  
Task: `docs/tasks/2026-10-04-thay-moi-giao-dien-stitch-marketplace.md` · Status: DONE (2 BUG MAJOR đã đóng) / QA GATE PENDING  
Artifacts: `docs/qa/2026-10-04-qa-doi-chieu-stitch-marketplace.md`, `qa-verify-latest.log`, `qa-smoke-latest.log` · Verify: `npm run verify` → PASS (81/81 test, build + precompress); `npm run smoke` → timeout/not verified; health :3000 → not verified · Next: tester xác nhận port 3000, chạy lại smoke và browser visual/accessibility 1440/390/320px; không cần FE sửa hai BUG MAJOR cũ nếu Network xác nhận resolver.

[BUG] 2026-10-04-thay-moi-giao-dien-stitch-marketplace · Severity: MAJOR  
Where: `client/src/pages/Home.jsx:11-17, 261-264` / trang `/` · Steps: 1) mở `/`; 2) API trả danh mục khác, thiếu danh mục, hoặc đổi tên key; 3) quan sát khối danh mục.  
Expected: danh mục và số lượng render động từ `CatalogContext`/API theo AC2; không bịa nhóm dữ liệu.  
Actual: `categoryTiles` là mảng tĩnh 6 nhóm và count lọc theo các key tĩnh, nên danh mục API có thể không hiển thị hoặc hiển thị sai số; đây cũng lệch hướng Stitch/task.  
Evidence: source search xác nhận `const categoryTiles = [...]`; build pass không bắt được lỗi dữ liệu runtime.  
Assign to: fe-coder

[BUG] 2026-10-04-thay-moi-giao-dien-stitch-marketplace · Severity: MAJOR  
Where: ProductCard/gallery trên `/`, `/san-pham`, `/product/:id` · Steps: 1) mở catalog có product id `1790591851824-ec9e6b0d15731839`; 2) mở DevTools Network hoặc quan sát ảnh card; 3) tải ảnh.  
Expected: ảnh lỗi dùng fallback qua helper hiện có, không request lỗi kéo dài và không có ô ảnh hỏng theo AC4.  
Actual: server log ghi `GET /products/1790591851824-ec9e6b0d15731839.jpg` trả 404 lặp lại nhiều lần.  
Evidence: `server-qa.log`, các request id gần nhất đều status 404; asset mới hiện nằm `server/public/images/products/1790591851824-ec9e6b0d15731839.jpg`, cho thấy đường dẫn runtime đang lệch prefix `/products/` với nơi serve thực tế `/images/products/`.  
Assign to: fe-coder

[BUG] 2026-10-04-thay-moi-giao-dien-stitch-marketplace · Severity: MINOR  
Where: Smoke gate / toàn bộ public routes · Steps: 1) chạy `npm run smoke`; 2) chờ tool hoàn tất.  
Expected: smoke kết thúc và báo pass/fail trong thời gian hợp lý theo AC10.  
Actual: lệnh root timeout sau 30 giây; server health cũng không chạy ổn định vì port 3000 đang bị chiếm.  
Evidence: command runner timeout; `server-qa.log` ghi `EADDRINUSE`.  
Assign to: tester

## Acceptance criteria đề xuất bổ sung

1. **Danh mục động:** Given `/api/categories` trả bất kỳ số lượng category hợp lệ, When mở Home/catalog, Then mọi category API xuất hiện đúng label/key/count; không có danh mục hardcode ngoài fallback UI.
2. **Ảnh runtime:** Given bất kỳ product image URL nào trả 404, When card/detail render, Then helper thay fallback trong một lần, không lặp request 404 và layout không có broken-image icon.
3. **Smoke reproducible:** Given port 3000 được giải phóng và server khởi động thành công, When chạy `npm run smoke`, Then tool hoàn tất với exit code rõ ràng trong <=120 giây và lưu artifact/screenshot; nếu server không sẵn sàng phải báo lỗi nguyên nhân thay vì treo.
4. **Stitch visual gate:** Given viewport 1440x900, 390x844 và 320px, When chụp Home/catalog/detail, Then shell, hero/editorial, trust strip, card density, gallery và CTA khớp hierarchy/palette/spacing của reference Stitch ở mức review thủ công; không copy logo/copy/asset reference.
5. **No overflow:** Given viewport 320px, When duyệt toàn bộ ba route, Then `document.documentElement.scrollWidth <= innerWidth`, không header/card/CTA bị tràn hoặc chồng.

## Kết luận

**QA: FAIL / NEEDS FIX.** Build production pass nhưng chưa đủ điều kiện DONE: còn 2 lỗi UI/dữ liệu mức MAJOR, smoke bị block/timeout và chưa có bằng chứng browser cho responsive/accessibility. Cần FE sửa hai BUG đầu, tester giải phóng port/chạy lại smoke và đối chiếu screenshot trước khi nghiệm thu.

[HANDOFF] tester -> fe-coder  
Task: `docs/tasks/2026-10-04-thay-moi-giao-dien-stitch-marketplace.md` · Status: NEEDS_INPUT  
Artifacts: `docs/qa/2026-10-04-qa-doi-chieu-stitch-marketplace.md`, `qa-build.log`, `qa-smoke.log` · Verify: `npm run build` → PASS; `npm run smoke` → timeout; server health → BLOCKED bởi EADDRINUSE/không kết nối ổn định · Next: fe-coder xử lý 2 BUG MAJOR (category động, asset URL/fallback); sau đó tester giải phóng port 3000, chạy lại `npm run verify` + `npm run smoke` và chụp browser ở desktop/mobile.
