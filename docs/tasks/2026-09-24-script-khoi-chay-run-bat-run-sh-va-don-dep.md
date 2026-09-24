# Task: Script khởi chạy nhanh `run.bat` / `run.sh` + dọn dẹp file không cần thiết

- **Ngày:** 2026-09-24 · **Người yêu cầu:** Chủ repo · **Loại:** Công cụ vận hành (gốc repo)
- **Không đổi:** hợp đồng API, UI, dependency, `package.json`, CI/CD.

## 1. Mục tiêu & bối cảnh

Chủ shop không quen gõ lệnh npm — cần cách **nhấn đúp 1 file là chạy được** web / test / dọn dẹp.
Song song đó, yêu cầu rà soát và dọn các file không cần thiết trong repo.

**Kết quả khảo sát hiện trạng (2026-09-24):**

| Hạng mục | Kết quả |
|---|---|
| File rác (`*.log *.tmp *.bak *.pyc .DS_Store ~$*`…) | Không có — repo sạch từ task 2026-09-22 |
| Cache tái tạo được | `client/node_modules/.vite` (Vite dep-cache) |
| Dung lượng lớn (đang CẦN, không xóa) | `crew/.venv` 793 MB (CrewAI), `node_modules` ~112 MB (FE+BE+tools) |
| Môi trường | Windows + Git Bash (`C:\Program Files\Git`) — WSL không có distro |

## 2. User story

> Là chủ shop, tôi muốn nhấn đúp một file là mở được menu: chạy web, chạy dev, test, build, dọn dẹp —
> và trên máy khác (Linux/macOS/Git Bash) vẫn dùng được script tương đương.

## 3. Quyết định kỹ thuật

| # | Quyết định | Vì sao |
|---|---|---|
| 1 | Thêm `run.bat` + `run.sh` tại gốc repo — **1 file mỗi nền tảng**, hỗ trợ menu + tham số | Không làm ratasets gốc repo bằng cả chục file .bat rời |
| 2 | `run.bat` chỉ dùng **ASCII + CRLF** | cmd.exe hỏng font với UTF-8; batch cần CRLF |
| 3 | `run.sh` dùng **UTF-8 + LF, không BOM** | bash hỏng shebang với CRLF/BOM |
| 4 | Thêm `.gitattributes` khóa eol (`*.sh` LF, `*.bat`/`*.ps1` CRLF) | Chống git hỏng line-ending khi qua máy khác |
| 5 | `clean` mặc định chỉ xóa thứ tái tạo được (`client/dist`, cache Vite, `tools/artifacts` trừ `.gitkeep`, `*.log`, `cur-*.png`); `clean deep` (có xác nhận) mới xóa `node_modules` + `crew/.venv` | Không phá môi trường đang dùng; dọn sâu phải chủ động |
| 6 | `start` tự build nếu thiếu `client/dist` | Nhấn đúp là chạy được dù chưa build |
| 7 | `smoke` tự health-check `:3000` trước khi chạy | Báo lỗi thân thiện thay vì Playwright crash |
| 8 | `crew` gọi `crew/.venv/Scripts/python.exe` (Windows) hoặc `crew/.venv/bin/python` (*nix) | Đúng quy ước AGENTS.md mục 5 |

**Không làm:** xóa `crew/.venv`/`node_modules`/`.env`/ảnh/docs (đang cần hoặc là dữ liệu thật);
không đổi `server/package.json` (predev dùng PowerShell là thiết kế hiện có — `run.sh` có fallback `node --watch`).

## 4. Acceptance criteria (Given/When/Then)

1. **WHEN** `run.bat test` **THEN** toàn bộ test backend pass (57/57 theo QA 2026-09-23), exit 0.
2. **WHEN** `bash run.sh test` (Git Bash) **THEN** pass, exit 0; `bash -n run.sh` không lỗi cú pháp.
3. **WHEN** `run.bat start` mà chưa có `client/dist` **THEN** tự build trước rồi mới start.
4. **WHEN** `run.bat smoke` / `./run.sh smoke` mà server chưa chạy **THEN** báo lỗi thân thiện, exit 1 (không crash Playwright).
5. **WHEN** `run.bat clean` **THEN** xóa `client/dist`, cache Vite, artifacts (giữ `.gitkeep`), log — **KHÔNG** đụng `node_modules`, `crew/.venv`, `.env`.
6. **WHEN** `clean deep` **THEN** xóa thêm `node_modules` (3 thư mục) + `crew/.venv`.
7. **WHEN** lệnh không hợp lệ (vd `run.bat xyz`) **THEN** in danh sách lệnh, exit 2.
8. **WHEN** `npm run verify` sau khi thêm file **THEN** pass — chứng minh repo không bị hỏng.
9. **WHEN** `git status` **THEN** chỉ có file mới, không phát sinh file rác.

## 5. Phạm vi file

- **Thêm:** `run.bat`, `run.sh`, `.gitattributes`, `docs/tasks/…` (file này), `docs/qa/…` (sau verify).
- **Sửa:** `README.md` (thêm mục "Khởi chạy nhanh").
- **Xóa:** `client/node_modules/.vite` (cache tái tạo được).
- **Không sửa:** `client/src/**`, `server/**`, `package.json`, CI/CD.
