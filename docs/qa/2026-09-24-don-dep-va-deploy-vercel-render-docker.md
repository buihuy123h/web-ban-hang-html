# QA: Dọn dẹp và deploy FE Vercel / BE Docker Render

- **Ngày kiểm thử:** 2026-09-24
- **Task:** `docs/tasks/2026-09-24-don-dep-va-deploy-vercel-render-docker.md`
- **Kết quả:** **PASS — có giới hạn môi trường Docker được ghi rõ**
- **Phạm vi:** kiểm tra tĩnh cấu hình Vercel/Docker/Render, test backend, build frontend tách origin, audit file; không deploy thật và không tạo order production.

## Bằng chứng chạy lệnh

| Lệnh/kiểm tra | Kết quả |
|---|---|
| `npm.cmd run verify` từ root | PASS: 57/57 test backend; Vite build PASS; precompress tạo 32 file Brotli/Gzip |
| Build với `VITE_API_URL=https://example-backend.invalid/api` | PASS; bundle chứa URL mẫu, không chứa `localhost:3000` |
| `client/vercel.json` | JSON hợp lệ; rewrite `/(.*)` về `/index.html` đúng mẫu SPA Vite hiện hành của Vercel |
| CORS | PASS: GET allow/deny origin; production cấm wildcard; preflight `/api/orders` và `/api/chat` trả 204, ACAO/method/header đúng |
| `docker info` | KHÔNG CHẠY ĐƯỢC: Docker CLI có nhưng daemon/pipe `docker_engine` không tồn tại; CLI cũng báo không đọc được config trong profile người dùng |
| `docker build --target test ...` | KHÔNG CHẠY ĐƯỢC do Docker engine/buildx profile không khả dụng; không tuyên bố image đã build/chạy |
| `npm.cmd run smoke` | Bỏ qua: chưa có server + database test cô lập được xác nhận; smoke hiện hữu có tạo order, nên không chạy lên môi trường có thể là production |
| `git diff --check` | PASS; chỉ có cảnh báo line ending LF/CRLF, không có whitespace error |
| Cleanup cuối sau QA | PASS: điều phối viên chỉ xóa artifact tái tạo được `client/dist` (515.195 byte); xác nhận thư mục không còn tồn tại và không build lại |

Test CORS được tăng độ phủ tại `server/test/security-hardening.test.js`: dùng đúng hai endpoint POST `/api/orders`, `/api/chat` và xác nhận cả `Content-Type`, `X-Request-Id`. Đây là thay đổi test, không sửa production.

## Đối chiếu acceptance criteria

| # | Kết quả | Bằng chứng |
|---:|---|---|
| 1 | PASS | Không có tracked file bị xóa (`git ls-files --deleted` rỗng). Các thay đổi dirty/untracked ban đầu nêu trong task vẫn còn; không reset/checkout/git clean. Cleanup cuối chỉ xóa `client/dist` (515.195 byte), là artifact gitignored có thể tái tạo. |
| 2 | PASS | Sau cleanup, `client/dist` không còn tồn tại. `.env`, ba thư mục `node_modules`, `crew/.venv`, ảnh, database scripts, fixtures, docs, launcher và `.gitkeep` đều còn nguyên. Không build lại vì verify trước đó đã PASS và build sẽ tái tạo chính artifact vừa dọn. |
| 3 | NOT RUN | Docker engine không khả dụng. Kiểm tra tĩnh: `server/Dockerfile` dùng `node:22-bookworm-slim`, build context `server/`, install không cần secret/DB. |
| 4 | NOT RUN | Không build được test stage Linux. Dockerfile có stage `test`, `ENV NODE_ENV=test`, `RUN npm test`; test host memory repository PASS 57/57. |
| 5 | NOT RUN | Không có container + SQL endpoint test để xác nhận runtime, port, health và SIGTERM. Kiểm tra tĩnh thấy `USER node`, `PORT` không hardcode trong CMD, healthcheck dùng `process.env.PORT`, app có graceful shutdown. |
| 6 | PASS | Final stage chỉ COPY thành phần `server/`; không COPY/build `client/dist`. Ảnh runtime được copy từ `public/images`. |
| 7 | PASS | Build mẫu PASS; bundle đóng `https://example-backend.invalid/api`; không tìm thấy `localhost:3000` trong bundle/source FE. |
| 8 | PASS | `productImages.js` bỏ `/api` khỏi API base rồi nối `/images/...`; bundle mẫu giữ logic này. `client/index.html` và dist không còn preload ảnh `/images/...` same-origin. |
| 9 | PASS | Rewrite Vercel đúng cấu hình SPA. Task, README và `App.jsx` đã thống nhất route `/san-pham`, `/cart`, `/product/:id`; không còn `/gio-hang` trong tài liệu task/deploy. |
| 10 | PASS | Test allowlist, deny origin, cấm wildcard production và preflight cụ thể cho orders/chat đều PASS. |
| 11 | PASS | 57/57 test API PASS; không thấy thay đổi hợp đồng method/path/schema/status. |
| 12 | PASS | Runbook Render và bảng thiết lập Vercel đủ root/build/output/Dockerfile/env/DB/health/log/rollback; các route kiểm tra đã khớp ứng dụng. |
| 13 | PASS có giới hạn | `npm.cmd run verify` PASS. Smoke bỏ qua có chủ đích vì không có môi trường DB cô lập và script tạo order. |

Tham chiếu kiểm tra cấu hình nền tảng: [Vercel Vite SPA](https://vercel.com/docs/frameworks/frontend/vite), [Render Docker](https://render.com/docs/docker), [Render health checks](https://render.com/docs/health-checks).

## Bug đã retest

```text
[BUG RESOLVED] don-dep-va-deploy-vercel-render-docker · Severity: MINOR
Where: client/README.md:135 và docs/tasks/2026-09-24-don-dep-va-deploy-vercel-render-docker.md AC #9
Steps: 1) Mở client/src/App.jsx 2) Đối chiếu route giỏ/chi tiết với tài liệu deploy 3) Thấy App dùng /cart và /product/:id, README đoạn kiểm tra lại ghi /gio-hang, task AC #9 cũng yêu cầu /gio-hang.
Expected: Tài liệu và acceptance criterion dùng đúng route thật đã có (/cart, /product/:id), hoặc analyst chốt rõ yêu cầu thêm alias mới.
Actual trước sửa: Hướng dẫn mâu thuẫn nội bộ và có thể khiến chủ repo kiểm tra một URL rơi vào NotFound.
Evidence retest: client/src/App.jsx:42 dùng /product/:id, :45 dùng /cart; client/README.md:117 và :135 cùng dùng route thật; task mục cấu hình và AC #9 đã đổi sang /cart, /product/:id.
Assign to: analyst
```

## Giới hạn còn lại trước deploy thật

1. Khi Docker daemon khả dụng, chạy thêm build test/final, inspect user/nội dung image và runtime health/SIGTERM trước khi tuyên bố image đã được kiểm chứng trên Linux.
2. Deploy thật vẫn cần repository đã push, tài khoản Vercel/Render và SQL Server production có TCP endpoint, SQL Authentication, TLS/certificate và firewall phù hợp.
