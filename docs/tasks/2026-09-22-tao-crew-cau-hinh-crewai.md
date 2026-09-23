# Task: Tạo & cấu hình CrewAI cho quy trình 4 giai đoạn

- **Ngày tạo:** 2026-09-22 · **Người yêu cầu:** chủ repo (trực tiếp qua Cline)
- **Loại task:** hạ tầng / công cụ AI — **không đổi** API, FE, BE của sản phẩm
- **Ghi chú quy trình:** giai đoạn [2] BACKEND và [3] FRONTEND không áp dụng (task tạo thư mục `crew/` mới, ngoài phạm vi `server/**` và `client/**`); [1] ANALYZE = file này; [4] QA = kiểm tra cú pháp + smoke test import (xem mục 7).

## 1. Mục tiêu & bối cảnh

Chủ repo đã định nghĩa đội hình 4 agent kèm model riêng trong `AGENTS.md` mục 2, nhưng mới chỉ tồn tại **trên giấy**: Cline không đọc model từ `AGENTS.md` (file markdown là tài liệu hướng dẫn, không phải cấu hình runtime). Cần triển khai **CrewAI thật bằng Python** để quy trình 4 giai đoạn (ANALYZE → BACKEND → FRONTEND → QA) chạy với đúng 4 model đã chỉ định.

## 2. User story

> Là chủ repo, tôi muốn chạy 1 lệnh `crew/.venv/Scripts/python.exe crew/crew.py "<yêu cầu>"` từ gốc repo để crew 4 agent (analyst → be_coder → fe_coder → tester) tự làm việc tuần tự đúng `AGENTS.md`, mỗi agent dùng đúng model riêng, để tôi không phải điều phối thủ công từng vai trò khi dùng Cline.

## 3. Luật nghiệp vụ & ràng buộc

1. Luồng `Process.sequential` bắt buộc; thứ tự: analyst → be_coder → fe_coder → tester.
2. `analyst` và `tester` luôn phải có trong mỗi lần chạy (gate chất lượng); `be`/`fe` bỏ được theo luật rút gọn AGENTS.md mục 3 (task thuần BE/FE).
3. Mỗi agent nhận đúng **phạm vi sửa file** và **mệnh lệnh cấm** từ bảng AGENTS.md mục 2 (ràng buộc bằng prompt — xem hạn chế ở mục 7).
4. Model mặc định đúng bảng AGENTS.md mục 2; cho phép ghi đè qua `crew/.env` (biến `MODEL_ANALYST` / `MODEL_BE_CODER` / `MODEL_FE_CODER` / `MODEL_TESTER`) mà không cần sửa code.
5. Model ID giữ nguyên định dạng như AGENTS.md (kiểu OpenRouter `vendor/model`); ưu tiên gọi qua OpenRouter bằng 1 key duy nhất; hỗ trợ gọi thẳng từng hãng qua LiteLLM.
6. Dependency Python cài trong venv riêng `crew/.venv` — **không đụng** `package.json` gốc, npm, CI/CD (luật AGENTS.md mục 6.2).
7. `crew/.env` (chứa key) phải bị gitignore; `.env.example` được commit làm mẫu.
8. Crew không tự commit/push/deploy (AGENTS.md mục 6.4); kết quả + log lưu vào `crew/output/`.
9. Chỉ chạy từ gốc repo (agent cần đường dẫn tương đối `AGENTS.md`, `server/`, `client/` đúng).

**Trường hợp biên:**
- Yêu cầu trống / chỉ khoảng trắng → báo lỗi tiếng Việt, thoát mã ≠ 0, không chạy crew.
- `--stages` chứa tên sai, hoặc thiếu `analyst`/`tester` → báo lỗi theo luật rút gọn.
- Tham số CLI là đường dẫn file tồn tại → dùng nội dung file làm yêu cầu (hỗ trợ yêu cầu dài).
- Thiếu API key → lỗi auth từ LiteLLM khi `kickoff()` — hướng dẫn rõ trong `crew/README.md`.

## 4. Hợp đồng API

**N/A** — task không thêm/sửa endpoint nào của sản phẩm (`/api/health`, `/api/categories`, `/api/products`, `/api/orders` giữ nguyên).

## 5. Phạm vi

**Tạo mới:** `crew/crew.py` · `crew/requirements.txt` · `crew/.env.example` · `crew/README.md` · file này.
**Sửa:** `.gitignore` (thêm `crew/.venv/`, `crew/output/`, `__pycache__/`, `!crew/.env.example`) · `AGENTS.md` (mục 2 & 5 — trỏ tới code crew thật).
**Không đụng:** `client/**` · `server/**` · `package.json` · `.github/workflows/**` · `tools/**`.

## 6. Acceptance criteria

1. **Given** môi trường có Python 3.10–3.13, **when** cài venv `crew/.venv` + `pip install -r crew/requirements.txt`, **then** cài thành công và import `crew/crew.py` không lỗi (smoke test).
2. **Given** `crew/.env` có `OPENROUTER_API_KEY` hợp lệ, **when** chạy `crew/crew.py "<yêu cầu code>"`, **then** crew tuần tự tạo được task file `docs/tasks/<YYYY-MM-DD>-<ten-task>.md` (giai đoạn analyst) rồi lần lượt qua be/fe/tester đúng stages.
3. **Given** yêu cầu task thuần FE, **when** chạy `--stages analyst,fe,tester`, **then** giai đoạn BE bị bỏ, log ghi rõ stages đã chạy.
4. **Given** `crew/.env` ghi đè `MODEL_TESTER=...`, **when** khởi tạo crew, **then** agent tester dùng model ghi đè (3 agent kia vẫn theo AGENTS.md).
5. **Given** git, **when** `git status`, **then** `crew/.env` và `crew/.venv/` không xuất hiện trong danh sách untracked, `.env.example` xuất hiện.
6. **Given** tham số trống hoặc `--stages` sai, **when** chạy lệnh, **then** hiện thông báo lỗi tiếng Việt rõ ràng, không chạy crew.

## 7. Kết quả QA

*(Cline sẽ ghi kết quả verify vào đây sau khi cài đặt + smoke test xong.)*
