# 🤖 Crew — quy trình 4 giai đoạn chạy bằng CrewAI

Triển khai **thật** bằng Python của quy trình trong `AGENTS.md` mục 3. Khác với
Cline/Cursor (dùng 1 model do IDE cấu hình, không đọc model từ file markdown),
crew này chạy đúng **4 agent — 4 model** theo bảng `AGENTS.md` mục 2, tuần tự:

```
analyst (openai/gpt-5.6-terra)  ->  be_coder (z-ai/glm-5.3)
   ->  fe_coder (moonshotai/kimi-k2.7-code)  ->  tester (anthropic/claude-opus-5)
```

Output của task trước là context của task sau (tuần tự). Ngoài ra, `be_coder` /
`fe_coder` / `tester` được bật **delegation** (`allow_delegation=True`): khi chạy
được cấp tool hỏi co-worker, có thể HỎI lại agent khác khi thiếu thông tin —
chỉ hỏi làm rõ, không chuyển việc làm thay (chi tiết ở mục 4). `analyst` giữ
tắt vì là giai đoạn đầu, không có agent trước để hỏi.

## Cấu trúc

| File | Vai trò |
|---|---|
| `crew.py` | 4 agent + 4 task, luồng `Process.sequential`, nhận yêu cầu từ tham số CLI |
| `requirements.txt` | Dependency Python (cài vào venv riêng, không đụng npm của repo) |
| `.env` | API key + model (tự tạo từ `.env.example`) — **đã gitignore** |
| `output/` | Full output sau mỗi lần chạy (tự tạo, gitignored) |

## 1) Cài đặt (một lần)

Yêu cầu **Python 3.10–3.13**. Từ gốc repo, PowerShell:

```powershell
python -m venv crew/.venv
crew/.venv/Scripts/pip install -r crew/requirements.txt
```

## 2) Cấu hình key (bắt buộc trước khi chạy)

```powershell
Copy-Item crew/.env.example crew/.env
notepad crew/.env
```

**Cách 1 (khuyên dùng) — 1 key cho cả 4 model:** điền `OPENROUTER_API_KEY`
(đăng ký tại https://openrouter.ai/keys). Model ID giữ nguyên như bảng AGENTS.md
vì cả 4 hãng đều có mặt trên OpenRouter. Nếu dùng dịch vụ tương thích OpenRouter
(vd xkiro), thêm dòng `OPENROUTER_BASE_URL=https://api.xkiro.com/v1` — mọi lượt
gọi sẽ trỏ sang dịch vụ đó, model ID vẫn giữ nguyên.

**Cách 2 — gọi thẳng từng hãng:** đặt key từng nhà cung cấp
(`OPENAI_API_KEY` / `MOONSHOT_API_KEY` / `ZAI_API_KEY` / `ANTHROPIC_API_KEY`)
và chỉnh `MODEL_*` trong `.env` sang định dạng LiteLLM tương ứng.

## 3) Chạy

Từ **gốc repo** (agent cần đường dẫn tương đối `AGENTS.md`, `server/`, `client/` đúng):

```powershell
crew/.venv/Scripts/python.exe crew/crew.py "thêm 5 sản phẩm đồ gỗ mới vào danh mục đồ gỗ"
```

Rút gọn giai đoạn (đúng luật AGENTS.md mục 3 — `analyst` và `tester` luôn bắt buộc):

```powershell
# task thuần BE (không đổi UI):
crew/.venv/Scripts/python.exe crew/crew.py --stages analyst,be,tester "..."
# task thuần FE (không đổi API):
crew/.venv/Scripts/python.exe crew/crew.py --stages analyst,fe,tester "..."
```

Yêu cầu dài: lưu vào file `.txt`/`.md` rồi truyền đường dẫn —
`crew/crew.py "docs/yeu-cau.md"` (nếu tham số là đường dẫn file tồn tại, nội dung
file sẽ được dùng làm yêu cầu).

Kết quả cuối cùng + log cả 4 agent được lưu vào `crew/output/<timestamp>.md`.

Trên Windows, crew dùng `npm.cmd` thay cho `npm` để không phụ thuộc execution
policy của PowerShell. Các nhánh `--help`, yêu cầu trống và `--stages` không hợp
lệ thoát trước khi đọc `.env` hoặc tạo LLM/agent/task/crew.

## 4) Lưu ý & giới hạn (biết trước khi dùng)

- **Phân quyền theo prompt, không phải sandbox:** mỗi agent được dặn kỹ phạm vi
  file được sửa (đúng bảng AGENTS.md mục 2), nhưng đây là ràng buộc bằng lời —
  LLM vẫn cầm tool ghi file và command npm giới hạn. Luôn `git diff` + review
  trước khi commit.
- **Delegation — agent hỏi nhau:** `be_coder` / `fe_coder` / `tester` bật
  `allow_delegation=True`; khi chạy, CrewAI cấp thêm tool `Ask question to
  coworker` / `Delegate work to coworker`. Luật (đã ghi trong backstory mỗi
  agent): chỉ dùng để HỎI làm rõ theo định tuyến AGENTS.md mục 4 (nghiệp vụ mơ
  hồ -> `analyst`; API/data/lỗi 500 -> `be-coder`; UI/logic FE -> `fe-coder`),
  không được chuyển việc cho agent khác làm thay. `analyst` giữ tắt. `max_iter`
  của từng agent là chặn an toàn chống hỏi qua lại vô hạn; nếu một lần chạy
  kéo dài bất thường, Ctrl+C rồi xem `crew/output/`.
- Agent be/fe/tester có command tool giới hạn bốn action `test`, `build`, `verify`,
  `smoke`, tương ứng với `npm.cmd test`, `npm.cmd run build`, `npm.cmd run verify`,
  `npm.cmd run smoke`. Tool không nhận lệnh shell tùy ý; smoke chỉ chạy khi server
  dự án đã được khởi động và xác minh an toàn.
- Crew **không tự commit/push** (đúng luật AGENTS.md mục 6.4).
- Đổi model bất kỳ: sửa `MODEL_*` trong `crew/.env` — không cần đụng code.
- Lỗi thường gặp: thiếu key (401), hết credit (402), sai tên model (400) —
  xem thông báo litellm trong output.
