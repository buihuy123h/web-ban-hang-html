# QA — Sẵn sàng production và tăng cường bảo mật

- **Ngày kiểm thử:** 2026-09-23
- **Task:** `docs/tasks/2026-09-23-san-sang-production-va-bao-mat.md`
- **Kết luận:** **NEEDS_INPUT** — unit/integration giả lập và build PASS; smoke SQL Server container chưa chạy được trên máy QA vì Docker daemon không khả dụng. Workflow cần được chạy bằng `workflow_dispatch` sau khi chủ repo cấu hình secret `CI_SQL_ADMIN_PASSWORD`.

## Kết quả gate

| Gate | Kết quả | Bằng chứng |
|---|---|---|
| Backend test | PASS | `npm.cmd test --prefix server` → 57/57 pass |
| Verify gốc repo | PASS | `npm.cmd run verify` → 57/57 pass + Vite build thành công |
| Workflow YAML/static | PASS | Hai YAML parse được; action pin full SHA, Node 22, SQL image pin digest; credential runtime qua `GITHUB_ENV`; release allowlist chứa đúng runtime `precompress.js`, audit high + SHA-256 |
| Build production | PASS | Vite 72 modules; precompress tạo Brotli/Gzip |
| Docker SQL integration | BLOCKED | `docker version` không kết nối được `//./pipe/docker_engine`; daemon chưa chạy/cài |
| Workflow smoke/release thực tế | NEEDS_INPUT | Cần GitHub secret `CI_SQL_ADMIN_PASSWORD` và chạy workflow trên GitHub runner |

## Đối chiếu acceptance criteria

1. **Windows Auth — PASS (unit/static), NEEDS_INPUT (hạ tầng thật).** Config chọn `msnodesqlv8`, trusted connection, instance/timeout/pool được test; chưa có Windows service account + SQL Server production để probe thật.
2. **SQL Auth CI — PASS (unit/static), BLOCKED (container).** Config SQL auth không dùng driver Windows; workflow dùng runtime login riêng. Docker local không khả dụng nên chưa kết nối container thật.
3. **Config fail-fast — PASS.** Test mode/credential/pool/timeout/TLS/proxy/CORS sai; entrypoint exit 1, log tên biến cấu hình và không lộ secret/stack.
4. **TLS — PASS (logic).** Production chặn `encrypt=false` và trust certificate; ngoại lệ self-signed chỉ qua đúng bộ cờ CI + SQL auth.
5. **Least privilege — PASS (static/script), BLOCKED (container).** Bootstrap chỉ grant SELECT catalog + EXECUTE procedure, deny ghi trực tiếp Orders/OrderItems. `tools/scripts/verify-sql-ci.js` xác minh ma trận quyền và thử direct INSERT/ALTER phải bị từ chối; cần workflow chạy thật để chốt.
6. **Readiness/lỗi DB — PASS.** Health 503/no-store khi repository không sẵn sàng; route DB trả lỗi chung, không lộ chi tiết; order repository chỉ trả sau procedure/transaction thành công.
7. **CORS/proxy — PASS.** Test allowlist, origin lạ, preflight, same-origin, cấu hình proxy hợp lệ/sai; production fail-closed.
8. **Security headers — PASS.** CSP bao phủ script/style/font/image/frame, không `unsafe-eval`; header cũ còn đủ; subprocess production chứng minh HSTS chỉ xuất hiện sau trusted HTTPS proxy.
9. **Chống lạm dụng — PASS.** Order/chat rate limit, `Retry-After`, controller không chạy sau 429, Map có giới hạn; JSON hỏng/oversize trả 400/413 no-store.
10. **Quan sát an toàn — PASS.** Request ID hợp lệ được giữ, ID dài/độc hại được thay; fatal handler chỉ đăng ký một lần, log mã đã sanitize và exit 1; response lỗi không có stack/secret.
11. **CI nhanh — PASS.** `npm test` + build chạy không cần SQL Server; workflow backend/frontend độc lập với job smoke, dùng Node 22 và action pin full SHA.
12. **Smoke production-like — NEEDS_INPUT.** Workflow đã pin SQL Server image/action SHA, bootstrap DB tạm, chạy backend production bằng runtime user, verify SQL + Playwright và cleanup. Chưa thể thực thi local; cần secret và Run workflow trên GitHub.
13. **Release gate — PASS (static), NEEDS_INPUT (thực thi).** Release phụ thuộc SQL integration, unit, audit high, build; artifact allowlist + SHA-256, action pin SHA. Allowlist chỉ lấy runtime và có `server/scripts/precompress.js` vì middleware require trực tiếp; không còn `free-port.ps1`/prestart tự dừng tiến trình production. Cần chạy workflow thật để xác nhận image/audit/artifact.
14. **Rollback thực tế — PASS (runbook), NEEDS_INPUT (hạ tầng).** Runbook có checksum, backup/restore test, versioned directory, atomic traffic switch, N-1 rollback; tự động deploy/rollback chưa thể có khi chưa khai báo host/service manager/reverse proxy/RTO-RPO.
15. **Không regress — PASS cho test/build; NEEDS_INPUT cho smoke DB.** 57/57 test và `npm run verify` pass, contract API/UI không đổi; smoke container còn chờ GitHub runner.

## Test và công cụ QA bổ sung

- `server/test/database.test.js`: dual auth, validation fail-fast, TLS guard, entrypoint log sanitize.
- `server/test/security-hardening.test.js`: CSP/header/HSTS production proxy, CORS/proxy, request ID, 400/413, rate limiter, fatal process, compression/ETag.
- `tools/scripts/verify-sql-ci.js`: health, catalog, tạo đơn qua API bằng runtime credential, kiểm tra permission matrix và khẳng định direct table write/DDL bị SQL Server từ chối; không log secret/PII.

## Việc chủ repo cần làm để chuyển NEEDS_INPUT thành PASS

1. Tạo GitHub Actions secret `CI_SQL_ADMIN_PASSWORD` đủ chính sách mật khẩu SQL Server, chỉ dùng cho DB container tạm.
2. Bấm **Run workflow** cho CI và xác nhận job `Smoke UI — Playwright` xanh.
3. Chạy release workflow trên commit/tag dự kiến phát hành; xác minh SQL gate, dependency audit, tarball và file `.sha256`.
4. Trước production, cấp service account Windows tối thiểu quyền, certificate SQL hợp lệ, firewall private, backup/restore drill và cấu hình reverse proxy/service manager theo runbook.
