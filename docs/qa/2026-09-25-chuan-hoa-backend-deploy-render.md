# QA: Chuẩn hóa backend Express để deploy Render

- **Ngày kiểm thử:** 2026-09-25
- **Task:** `docs/tasks/2026-09-25-chuan-hoa-backend-deploy-render.md`
- **Kết quả:** **PASS**, với giới hạn môi trường được ghi rõ bên dưới
- **Phạm vi:** backend Express, cấu hình Render/Docker, SQL Server, CORS, ảnh, frontend handoff và an toàn secret

## Kết quả lệnh kiểm chứng

| Kiểm tra | Kết quả |
|---|---|
| `npm.cmd run verify` từ gốc repo | PASS — backend **61/61** test; Vite build thành công (72 module) |
| Test tập trung cấu hình Render | PASS — 2/2: chặn Windows Authentication trên Render; kiểm tra `DB_SERVER` TCP |
| `git diff --check` | PASS — không có whitespace error; chỉ có cảnh báo LF/CRLF của Git trên Windows |
| Audit chữ ký secret trên file được Git theo dõi | PASS — không tìm thấy credential/key tĩnh trong mã runtime |
| Docker Engine | Không khả dụng — daemon `dockerDesktopLinuxEngine` không chạy, nên không thể build/inspect image thật |
| `npm run smoke` | Không chạy — script `tools/scripts/smoke.js` có luồng đặt hàng end-to-end (`POST /api/orders`) và phiên QA không có DB cô lập |

## Đối chiếu acceptance criteria

| # | Kết quả | Bằng chứng |
|---|---|---|
| 1. Monorepo đúng | PASS | Runbook chỉ dẫn duy nhất: Root Directory `server`, Dockerfile `Dockerfile`, context `.`, không build/copy frontend. |
| 2. Bind Render | PASS | `parsePort` chặn số ngoài `1..65535`; test xác nhận socket bind `0.0.0.0` và cổng động trong test. |
| 3. Readiness thật | PASS | App kết nối và probe `SELECT 1` trước khi listen; health trả 200/connected khi ready và 503/disconnected không lộ chi tiết khi mất DB. Không có fallback JSON production. |
| 4. Docker an toàn | PASS qua audit tĩnh | `node:22-bookworm-slim`, `npm ci` theo lockfile, final stage explicit-copy, `USER node`, `CMD ["npm", "start"]`; final stage không copy `.env`, frontend, test, docs, database/migration hoặc `data/products.json`. Chưa build image thật vì Docker daemon không chạy. |
| 5. SQL production | PASS qua code/test/tài liệu | Render buộc `DB_AUTH_MODE=sql`; TLS production buộc encrypt và không trust certificate; repository dùng query có bind và stored procedure; runbook yêu cầu runtime login tối thiểu cùng firewall outbound CIDR. Không kết nối DB production thật trong QA. |
| 6. Config fail-closed | PASS | Test chặn credential thiếu, boolean/pool/timeout sai, TLS không an toàn, Windows Authentication khi `RENDER=true`, và `DB_SERVER` thiếu/protocol/path/port/localhost/named instance. Lỗi entrypoint được lọc và không in secret/stack. |
| 7. CORS | PASS | Allowlist echo đúng origin + `Vary`; origin lạ không có ACAO; preflight `/api/orders` và `/api/chat` trả 204 với method/header đúng; wildcard/path/userinfo bị chặn ở production. |
| 8. FE handoff | PASS qua audit tĩnh | Runbook yêu cầu `VITE_API_URL=https://<backend>.onrender.com/api` và redeploy FE. `productImages.js` suy ra origin ảnh từ `API_BASE`; không hardcode hostname Render trong source. |
| 9. Ảnh bền theo deploy | PASS | Docker final stage copy `public/images`; test ảnh thật trả 200/cache immutable và kiểm tra path fixture có file. Runbook nêu rõ filesystem ephemeral, asset versioned và không upload runtime. |
| 10. API không regress | PASS | Toàn bộ 61 test pass, bao gồm health, catalog, product detail, order validation/pricing, chat/fallback, ảnh, status/schema và rate limit. |
| 11. Gate | PASS với giới hạn Docker | `npm.cmd run verify` pass; Docker đã được thử nhưng daemon không khả dụng, nên chỉ audit tĩnh theo điều kiện của task. |
| 12. Runbook đủ dùng | PASS | Có điều kiện DB/TLS/firewall, đúng field Render, bảng env, health/catalog/ảnh/CORS, log, Vercel handoff, filesystem và rollback. |
| 13. Secret an toàn | PASS có hành động bắt buộc trước push | Không đọc nội dung file nhạy cảm. `git status` vẫn cho thấy `recovery-codes.txt` chưa được theo dõi; tuyệt đối không stage/commit, cần chuyển khỏi repo hoặc xóa an toàn và rotate nếu từng chia sẻ/commit. |

## Bug đã phát hiện và retest

### 1. Render từng chấp nhận Windows Authentication

- **Mức độ:** MAJOR
- **Trước sửa:** cấu hình production có thể nhận `DB_AUTH_MODE=windows` nếu trust-certificate là `false`.
- **Sau sửa:** `RENDER=true` buộc `DB_AUTH_MODE=sql`; production Windows ngoài Render vẫn được phép để không phá quy trình Windows service hiện hữu.
- **Retest:** PASS.

### 2. Render từng nhận `DB_SERVER` thiếu hoặc sai dạng

- **Mức độ:** MAJOR
- **Trước sửa:** thiếu biến rơi về `.\\SQLEXPRESS`; giá trị có protocol/path cũng được nhận.
- **Sau sửa:** khi `RENDER=true`, biến bắt buộc là hostname/IP TCP thuần và chặn missing, protocol, path, port, loopback cùng named instance.
- **Retest:** PASS.

## Giới hạn và bước kiểm tra khi triển khai thật

QA không deploy ra Render/Vercel, không kết nối SQL Server production và không tạo đơn hàng thật. Khi Docker Engine khả dụng, cần chạy từ `server/`:

```powershell
docker build --target test --tag do-cu-quang-huy-api:test .
docker build --tag do-cu-quang-huy-api:local .
docker inspect --format '{{.Config.User}}' do-cu-quang-huy-api:local
```

Kỳ vọng stage test pass, final image build được và user là `node`. Sau deploy, chỉ kiểm tra read-only `/api/health`, `/api/categories`, `/api/products`, một URL `/images/...` và CORS/preflight; không gọi tạo đơn trên production.

## Kết luận

Các thay đổi đạt 13 acceptance criterion trong phạm vi có thể kiểm chứng local. Hạn chế Docker daemon và hạ tầng ngoài repo đã được ghi rõ, không giả lập thành kết quả pass thực tế. Repo sẵn sàng cho bước cấu hình Render sau khi chủ repo xử lý file nhạy cảm chưa được theo dõi và có SQL Server production reachable qua TCP/TLS.
