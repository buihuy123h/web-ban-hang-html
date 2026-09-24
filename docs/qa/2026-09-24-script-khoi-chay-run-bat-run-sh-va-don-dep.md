# QA Report: Script khởi chạy `run.bat` / `run.sh` + dọn dẹp file không cần thiết

- **Ngày:** 2026-09-24 · **Task:** `docs/tasks/2026-09-24-script-khoi-chay-run-bat-run-sh-va-don-dep.md`
- **Môi trường verify:** Windows + PowerShell (cmd) · Git Bash `C:\Program Files\Git\bin\bash.exe` · Node ≥22

## 1. Đối chiếu acceptance criteria

| # | Tiêu chí (Given/When/Then) | Kết quả | Bằng chứng |
|---|---|---|---|
| 1 | `run.bat test` → toàn bộ test pass, exit 0 | ✅ PASS | 57/57 pass, exit 0 (chạy 2 lần: standalone + trong verify) |
| 2 | `bash -n run.sh` hợp lệ; `bash run.sh test` pass, exit 0 | ✅ PASS | bash -n OK (LF, UTF-8 không BOM — 3 byte đầu `35 33 47`); run.sh test → 57/57, exit 0 |
| 3 | `run.bat start` thiếu `client/dist` → tự build trước | ✅ PASS* | Nhánh đã rà code; bản thân lệnh build được chứng minh xanh riêng (2.11s). *Không chạy thật `start` (server chạy vô hạn) |
| 4 | `smoke` khi server chưa chạy → báo lỗi thân thiện, exit 1 | ✅ PASS | `.bat`: "[LOI] Server chua chay tai :3000…", exit 1 · `.sh`: "[LỖI] Server chưa chạy…", exit 1 |
| 5 | `run.bat clean` → xóa dist/cache/artifacts, giữ `.gitkeep` + deps | ✅ PASS | Sau clean: `client/dist` = False, `.gitkeep` = True, `client/node_modules` = True, `crew/.venv` = True, exit 0 (trả lời N khi hỏi deep) |
| 6 | `clean deep` → xóa thêm node_modules + crew/.venv | ⚠️ Không chạy | Cố ý không thực thi để không phá môi trường đang dùng (~900 MB phải cài lại); logic = 4 lệnh rd/rm đơn giản |
| 7 | Lệnh sai → in danh sách lệnh/usage, exit 2 | ✅ PASS | `run.bat xyz` exit 2 · `run.sh badcmd` in "Lệnh không hợp lệ" + usage, exit 2 |
| 8 | `run.bat verify` → pass (test + build) | ✅ PASS | 57/57 test + `✓ built in 2.11s` + precompress 32 bản nén (Brotli −229.8 KB · Gzip −217.2 KB), `VERIFY_DONE exit=0` |
| 9 | `git status` chỉ có file dự kiến | ✅ PASS | `M README.md` + 4 file mới (`run.bat`, `run.sh`, `.gitattributes`, task doc) — không phát sinh rác |
| 10 | Menu nhấn đúp | ✅ PASS | `echo 0 \| run.bat` → menu render, chọn 0 → exit 0 |

## 2. Dọn dẹp đã thực hiện

- **Xóa:** `client/node_modules/.vite` (18 file, 3.45 MB — cache Vite, tự tạo lại khi `npm run dev`).
- **Rà toàn bộ repo:** không có `*.log *.tmp *.bak *.pyc *.orig *.swp .DS_Store ~$*`, không `test-results/`, `playwright-report/`, `coverage/`, `release/`, `logs/`, `crew/output/` — repo sạch từ task 2026-09-22.
- **Giữ nguyên (đang cần):** `crew/.venv` 793.4 MB (CrewAI), `node_modules` ~112 MB (client 43.8 + server 50.9 + tools 17.6), `client/dist` ~0.5 MB (bản build), `server/.env` + `crew/.env` (secrets, đã gitignore đúng).
- **2 ảnh trùng nội dung (chỉ ghi nhận, KHÔNG xóa):** `catalog/luu-tru.jpg` ≡ `products/ke-inox-4-tang.jpg` (MD5 giống nhau, 231 KB) — cả 2 đường dẫn có thể đang được DB/fixture tham chiếu; đề nghị chủ repo rà `server/docs/DATABASE.md` trước khi quyết định.

## 3. Sự cố trong lúc verify (không do thay đổi code)

- **Lần chạy `verify` đầu tiên:** 1 test FAIL với `ENOBUFS 127.0.0.1:65524` (`chat-rate.test.js`) — cạn cổng/buffer TCP ephemeral vì suite bị chạy 3 lần liên tiếp trong ~2 phút (TIME_WAIT Windows ~120s). Chờ cổng nhả rồi chạy lại → **verify xanh, exit 0**. Không phải regression.

## 4. Hạn chế & ghi chú

- `dev` (2 tiến trình dài hạn) và `crew` (pipeline AI) không chạy thật trong phiên verify vì tính chất long-running; cả hai chỉ bọc các npm script đã được chứng minh (`npm run dev:server`, `npm run dev:client`, `crew/.venv/Scripts/python.exe`).
- `run.sh deploy` trên Linux: `deploy.ps1` là Windows-only → script tự rẽ nhánh verify + start nền (log `server.log`, đã nằm trong `*.log` gitignore).
- `.gitattributes` mới khóa eol cho `*.sh`(LF) / `*.bat *.cmd *.ps1`(CRLF) — thêm theo quyền chủ repo, không đụng package.json/CI.
