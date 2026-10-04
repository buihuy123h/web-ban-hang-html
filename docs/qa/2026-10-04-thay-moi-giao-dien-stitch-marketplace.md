# QA — Thay mới giao diện Stitch Marketplace

**Kết luận: FAIL (build/verify đạt; smoke UI chưa đạt).**

## Phạm vi kiểm tra

Đã đọc task spec `docs/tasks/2026-10-04-thay-moi-giao-dien-stitch-marketplace.md` và đối chiếu ở mức build/static. Không sửa `client/**` hoặc production code.

## Kết quả lệnh

- `npm run verify` → **PASS**
  - Backend: **81/81 test pass**, 0 fail.
  - Vite production build: **PASS** (82 modules transformed).
  - Precompress: **PASS**, tạo 40 bản nén.
- `npm run smoke` → **FAIL/BLOCKED**
  - Server đã sẵn sàng trên `http://localhost:3000` (HTTP `/` trả 200).
  - Smoke bị crash tại `tools/scripts/smoke.js:34` khi mở `/`, lỗi `page.goto: Timeout 20000ms exceeded` trong trạng thái `waitUntil: "networkidle"`.
  - Đã thử lại smoke với `SMOKE_OFFLINE=1`; lần thử qua process environment bị lỗi môi trường npm (`Cannot find module ...node_modules/npm/bin/npm-cli.js`), nên không dùng làm bằng chứng đạt.

## Đối chiếu acceptance criteria ở mức static/build

| # | Tiêu chí | Kết quả | Ghi chú |
|---|---|---|---|
| 1 | Shell/nhận diện | CHƯA ĐỦ BẰNG CHỨNG | Build pass; cần smoke/browser để xác nhận console và responsive. |
| 2 | Home marketplace | CHƯA ĐỦ BẰNG CHỨNG | Không hoàn tất được smoke tại `/`. |
| 3 | Catalog + URL filter | CHƯA ĐỦ BẰNG CHỨNG | Cần browser flow. |
| 4 | Card + ảnh | CHƯA ĐỦ BẰNG CHỨNG | Build pass; chưa chạy được flow ảnh/fallback. |
| 5 | Product detail | CHƯA ĐỦ BẰNG CHỨNG | Cần browser flow. |
| 6 | Cart + đặt hàng | CHƯA ĐỦ BẰNG CHỨNG | Cần browser flow end-to-end. |
| 7 | Saved/contact/chat | CHƯA ĐỦ BẰNG CHỨNG | Cần browser flow và xử lý lỗi. |
| 8 | Responsive/accessibility | CHƯA ĐỦ BẰNG CHỨNG | Cần kiểm tra viewport/keyboard/reduced-motion. |
| 9 | API + hồi quy | CHƯA ĐỦ BẰNG CHỨNG | Backend test pass; smoke route/deep-link chưa chạy xong. |
| 10 | Build/verify | PASS một phần | `npm run verify` pass; smoke bắt buộc khi server chạy chưa pass. |

## Bug report

```text
[BUG] thay-moi-giao-dien-stitch-marketplace · Severity: MAJOR
Where: tools/scripts/smoke.js:34 / smoke navigation to http://localhost:3000/
Steps: 1) Đảm bảo server đang listen trên cổng 3000. 2) Từ gốc repo chạy `npm run smoke`. 3) Chờ smoke mở route `/`.
Expected: Smoke mở trang chủ trong tối đa 20 giây, tiếp tục kiểm tra các route/flow và kết thúc với exit code 0 nếu không có lỗi UI.
Actual: Playwright timeout sau 20 giây tại `page.goto(..., { waitUntil: "networkidle" })`, smoke crash trước khi chạy các acceptance flow.
Evidence: `page.goto: Timeout 20000ms exceeded`; server `GET /` trả HTTP 200; `npm run verify` pass 81/81 test và production build pass.
Assign to: fe-coder
```

**Next:** fe-coder điều tra request/asset khiến Playwright không đạt `networkidle` (hoặc điều chỉnh smoke nếu nguyên nhân là test harness), sau đó tester chạy lại `npm run smoke` và đối chiếu đủ 10 tiêu chí.
