# QA — Hoàn thiện & kiểm chứng toàn bộ dự án (end-to-end)

- **Ngày kiểm thử:** 2026-09-23
- **Task:** rà soát tổng thể theo yêu cầu chủ repo ("hoàn thiện toàn bộ dự án, cấu hình chuẩn, xóa file không cần, sửa chỗ sai")
- **Kết quả:** PASS
- **Phạm vi:** toàn repo (client + server + tools + docs + cấu hình)

## Gate bắt buộc

Chạy từ gốc repo:

```powershell
npm test           # 39/39 test API pass (5 bộ, node:test)
npm run build      # Vite production build pass + precompress 32 bản nén Brotli/Gzip
npm run verify     # = test + build → PASS
```

## Smoke runtime (server production thật, SQL Server `.\\SQLEXPRESS`)

| Kiểm tra | Kết quả |
|---|---|
| `GET /api/health` | 200, `ok:true`, `database:"connected"` |
| `GET /api/categories` | 200 — 6 danh mục từ SQL Server |
| `GET /api/products?limit=2` | 200, JSON nén, ETag + rate-limit + security headers đủ |
| `GET /api/products/1` | 200 — chi tiết + specs + related đúng contract |
| `POST /api/orders` | 201 — mã `DI…`, tính tiền đúng theo giá server (85.000×2 + 30.000 ship = 200.000đ) |
| `POST /api/chat` | 200, mode `fallback` (chưa có XKIRO_API_KEY) — trả đúng chính sách ship 30k/45k/freeship 500k |
| `GET /` và deep-link SPA | 200 `text/html` (SPA fallback hoạt động) |
| `GET /images/catalog/noi-chao.jpg` | 200 `image/jpeg`, cache immutable 30 ngày |
| `npm run smoke` (Playwright) | **15/15 PASS** — bấm toàn bộ nút 7 trang, luồng thêm giỏ → đặt hàng, mobile không tràn ngang |

## Sửa trong phiên này

| File | Thay đổi | Lý do |
|---|---|---|
| `server/controllers/health.controller.js` | `name: 'inox-store-api'` → `'do-cu-quang-huy-api'` | Tên cũ sót lại sau rebrand; không test/tool nào assert giá trị cũ |
| `tools/scripts/smoke.js` |Thông báo ảnh chụp `tools/shot-*.png` → `tools/artifacts/shot-*.png` | Tin nhắn sai đường dẫn thật (ảnh ghi vào artifacts/) |
| `README.md` | Cây cấu trúc bổ sung `AGENTS.md`, `crew/`, `docs/` | Cây thư mục cũ thiếu 3 mục đang tồn tại thật |
| `package.json` (gốc) | `engines.node` `>=18` → `>=20.12` | Khớp yêu cầu thật của server (`process.loadEnvFile` cần Node ≥ 20.12) |

## Dọn dẹp dữ liệu kiểm thử

- Đơn thử do QA tạo trong phiên (curl + smoke) đã **xóa khỏi SQL Server**:
  `DI21034723` (Test QA) và `DI42393740` (smoke) — cascade xóa OrderItems.
  Sau dọn: Orders 5 dòng, OrderItems 12 dòng — **nguyên vẹn dữ liệu gốc** (đơn 1–5 ngày 2026-09-21).
- Ảnh chụp smoke trong `tools/artifacts/*.png` (gitignored, tự sinh lại) đã dọn, giữ `.gitkeep`.
- File rác tại gốc repo: **không có** (chỉ `.gitignore`, `AGENTS.md`, `package.json`, `README.md`).

## Đã xác nhận KHÔNG cần xóa thêm

- `.agents/` — skills IDE có chủ đích, đã được git track.
- `crew/` (`.venv` đã gitignore) + `tools/` (12 script đều có npm script + README).
- `server/data/products.json` (fixture test/seed) + `chat-knowledge.json` (nguồn RAG chatbot).
- `client/dist/` — build artifact gitignored, cần cho production serve.
- Các file legacy (server.js, generate-seed.cjs, design-reference/…) đã bị xóa ở phiên trước — đúng như `docs/tasks/2026-09-22-don-dep-cau-hinh-du-an.md`.

## Ghi chú / hạn chế biết trước

1. **Job `smoke` trong `.github/workflows/ci.yml`** (chỉ chạy khi bấm *Run workflow* trên GitHub) sẽ
   không khởi động được server trên runner Ubuntu vì không có SQL Server + ODBC driver theo cấu hình
   Windows Authentication hiện tại. CI thường (backend test + frontend build) không bị ảnh hưởng.
   Nếu muốn smoke chạy được trên GitHub cần thêm service container SQL Server — **chưa sửa vì nằm
   trong vùng CI-CD cần chủ repo duyệt** (luật AGENTS.md mục 6.2).
2. Chatbot đang chạy mode `fallback` (thân thiện, rule-based) vì `server/.env` chưa có `XKIRO_API_KEY` —
   web hoạt động bình thường; muốn bật AI thật thì điền key theo `server/.env.example`.
3. Toàn bộ thay đổi từ các phiên trước + phiên này **chưa commit** (đúng luật mục 6.4) — chủ repo xem
   `git status` / `git diff` rồi tự commit khi sẵn sàng.

## Kết luận

Dự án hoàn thiện ở mức chạy được end-to-end: test 39/39, build pass, server production kết nối SQL
Server thật, UI smoke 15/15, cấu hình chuẩn (env, gitignore, CI/CD, engines). Không phát hiện lỗi
blocker/major. Không xóa file cấu trúc nào ngoài artifact tạm đã nêu trên.

[HANDOFF] tester -> chủ repo
Task: hoàn thiện toàn bộ dự án · Status: DONE
Artifacts: `docs/qa/2026-09-23-hoan-thien-toan-bo-du-an.md` + 4 file sửa nhỏ (health.controller.js, smoke.js, README.md, package.json) · Verify: `npm test` 39/39 · `npm run build` exit 0 · runtime API/SPA/images/chat/orders PASS · `npm run smoke` 15/15 · Next: (tuỳ chọn) điền `XKIRO_API_KEY` để bật AI chat thật; duyệt thêm service SQL Server cho job smoke CI; commit các thay đổi đang chờ.
