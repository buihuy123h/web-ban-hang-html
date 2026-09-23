# AGENTS.md — Quy tắc làm việc trên repo **Đồ Cũ Quang Huy**

> **Nguồn sự thật duy nhất** cho mọi AI agent (CrewAI, Cline, Cursor, Copilot…). Đọc `README.md` + file này **trước** khi làm bất cứ việc gì. Quyết định cuối cùng thuộc **chủ repo** — không rõ thì hỏi, đừng tự đoán.
> Nguyên tắc xuyên suốt: **đúng quy trình, ngắn gọn, không lãng phí token & thời gian**.

## 1. TRIAGE — bước đầu tiên với mọi yêu cầu

| Loại yêu cầu | Cách xử lý |
|---|---|
| Hỏi đáp / giải thích / gợi ý / review — **không cần sửa file** | Trả lời trực tiếp, đúng trọng tâm là hoàn thành. **Không** chạy quy trình 4 giai đoạn, không tạo docs, không handoff. |
| Viết code / **tối ưu code** / **fix lỗi** / sửa data / tính năng mới | Chạy đủ quy trình 4 giai đoạn (mục 3), đúng vai trò. |

## 2. Đội hình & phạm vi (mỗi agent chỉ làm đúng vai trò)

| Vai trò | Agent ID · Model | Được sửa | Bị cấm |
|---|---|---|---|
| 🧭 BA — phân tích nghiệp vụ | `analyst` · openai/gpt-5.6-terra | `docs/tasks/**` | Sửa code FE/BE; chạy build/deploy |
| 🎨 FE — frontend | `fe-coder` · moonshotai/kimi-k2.7-code | `client/**` (trừ `client/dist/`) | Sửa `server/**`; thêm thư viện/UI framework chưa duyệt |
| ⚙️ BE — backend | `be-coder` · z-ai/glm-5.3 | `server/**` (`public/images/` chỉ thêm ảnh khi task yêu cầu) | Sửa `client/**`; đổi JSON data sang DB khác khi chưa duyệt |
| 🧪 QA — kiểm thử | `tester` · anthropic/claude-opus-5 | `server/test/**`, `tools/scripts/**`, `docs/qa/**` | Sửa code production; sửa test cho "đẹp số" |

Việc ngoài phạm vi → handoff cho đúng agent, **không tự xử**.
CrewAI: `process: sequential`, agents `analyst / be_coder / fe_coder / tester` khớp bảng trên; handoff & bug routing theo mục 4. **Code triển khai thật nằm ở `crew/`** — chạy từ gốc repo: `crew/.venv/Scripts/python.exe crew/crew.py "<yêu cầu>"`; model + API key cấu hình tại `crew/.env` (hướng dẫn: `crew/README.md`).

## 3. Quy trình 4 giai đoạn — **chỉ áp dụng cho task code** (xem TRIAGE mục 1)

```
Yêu cầu code
  [1] ANALYZE   analyst  → docs/tasks/<YYYY-MM-DD>-<ten-task-kebab-case>.md
  [2] BACKEND    be-coder → API đúng hợp đồng + `npm test` pass          (làm trước FE nếu đổi API/data)
  [3] FRONTEND  fe-coder → UI hoàn chỉnh + `npm run build` pass
  [4] QA        tester   → `npm run verify` (+ `npm run smoke` nếu dính UI)
       PASS → ✅ DONE, báo chủ repo
       FAIL → 🐞 bug report → định tuyến đúng agent (mục 4) → sửa → lặp lại [4]
```

**Rút gọn:** task thuần FE (không đổi API) → bỏ [2]; thuần BE (không đổi UI) → bỏ [3]. Agent bị bỏ qua không cần xác nhận, chỉ ghi rõ trong handoff.

**Chi tiết từng giai đoạn:**
- **[1] analyst:** đọc `README.md` + docs liên quan; tạo task file gồm: mục tiêu & bối cảnh, user story, luật nghiệp vụ (kể cả trường hợp biên), hợp đồng API nếu có (method/path/body/response JSON/mã lỗi — ràng buộc cả BE lẫn FE), phạm vi, acceptance criteria dạng Given/When/Then. Xong khi BE code được **mà không phải hỏi lại nghiệp vụ**.
- **[2] be-coder:** đọc task + cấu trúc MVC `server/` (`index.js` → `app.js` → `routes/` → `controllers/` → `models/`) + `server/docs/DATABASE.md`; đúng **100% hợp đồng** — không tự đổi path/field; dữ liệu runtime nằm trong SQL Server (sửa qua SSMS), `server/data/products.json` chỉ là fixture test/seed, ảnh vào `server/public/images/`, JSON chỉ lưu đường dẫn `/images/...`; test bằng `node:test` (0 dependency) trong `server/test/`; `npm test` pass mới bàn giao, kèm request/response mẫu đã chạy được.
- **[3] fe-coder:** đọc task + design system `client/docs/` + cấu trúc `client/src/`; tái sử dụng component sẵn có, trang mới lazy-load trong `App.jsx`; gọi API **chỉ qua lớp** `client/src/api/`; ảnh qua helper `client/src/data/productImages.js` (không nhúng vào bundle); `npm run build` pass mới bàn giao, kèm các bước thao tác để QA test.
- **[4] tester:** đối chiếu **từng** acceptance criteria; test API vào `server/test/`, UI dùng Playwright theo quy ước `tools/README.md`; PASS → ghi `docs/qa/<task>.md` + báo DONE; FAIL → bug report (mục 4), **tuyệt đối không tự sửa code production**.
- Tranh chấp hợp đồng API BE↔FE → `analyst` chốt và cập nhật `docs/tasks/`; không ai tự thay đổi hợp đồng. Vượt thẩm quyền (kiến trúc, dịch vụ ngoài) → dừng, hỏi chủ repo.

## 4. Handoff & bug report (format bắt buộc, không chat lan man)

```text
[HANDOFF] <from> -> <to>
Task: <tên task / file docs/tasks/…> · Status: DONE | BLOCKED | NEEDS_INPUT
Artifacts: <file đã tạo/sửa> · Verify: <lệnh + kết quả, VD: npm test → 21/21 pass> · Next: <bước kế tiếp>
```
- BLOCKED / NEEDS_INPUT: nêu rõ thiếu gì, đã thử gì; kẹt quá 2 lần → hỏi chủ repo.
- Không handoff khi chưa chạy xong lệnh verify của vai trò mình.

**Định tuyến bug:** UI/logic FE → `fe-coder` · API/data/lỗi 500 → `be-coder` · nghiệp vụ mơ hồ/mâu thuẫn → `analyst` · test sai → `tester` tự sửa test.

```text
[BUG] <task> · Severity: BLOCKER | MAJOR | MINOR
Where: <file + dòng / trang + bước> · Steps: 1) … 2) … 3) …
Expected: <kỳ vọng> · Actual: <thực tế> · Evidence: <log/screenshot/artifact>
Assign to: <fe-coder | be-coder | analyst>
```

## 5. Bối cảnh dự án (stack — KHÔNG đổi khi chưa duyệt)

- **FE:** React 18 + Vite 5 + react-router-dom 6 — `client/` — dev :5173, proxy `/api` + `/images` → :3000.
- **BE:** Express 4 — `server/` (MVC: `index.js` → `app.js` → `routes/` → `controllers/` → `models/` + `middleware/`) — :3000 — `GET /api/health`, `GET /api/categories`, `GET /api/products`, `POST /api/orders`, `POST /api/chat` — gzip + ETag, rate limit, security headers.
- **Data:** SQL Server `DoCuQuangHuy` là nguồn runtime (xem `server/docs/DATABASE.md`) · `server/data/products.json` chỉ là fixture test/seed · Ảnh: `server/public/images/` (cache 30 ngày).
- **Test:** BE `node:test` (39 test, 5 bộ trong `server/test/`) · UI Playwright trong `tools/` · CI/CD `.github/workflows/` không sửa khi chưa duyệt.
- **Lệnh chuẩn (gốc repo, PowerShell):** `npm run setup` (cài 1 lần) · `npm run dev:server` (:3000) · `npm run dev:client` (:5173) · `npm test` · `npm run build` · `npm run verify` (gate bắt buộc trước DONE) · `npm run smoke` (cần server chạy) · `npm start` (production :3000) · `crew/.venv/Scripts/python.exe crew/crew.py "<yêu cầu>"` (crew AI 4 giai đoạn — cần `crew/.venv` + `crew/.env`, xem `crew/README.md`).
- **Môi trường:** Windows + PowerShell; đường dẫn có khoảng trắng (`D:\web ban hang html`) → luôn bọc trong ngoặc kép.
- **Ngôn ngữ:** UI + tài liệu = tiếng Việt; tên biến/hàm/commit = tiếng Anh, ngắn gọn.

## 6. Luật chung

1. Chỉ sửa trong phạm vi vai trò (mục 2); ngoài phạm vi → handoff đúng agent.
2. Không thêm/bớt dependency, không đổi cấu hình build, không sửa `package.json` gốc / CI-CD khi chưa được duyệt.
3. FE không hardcode `http://localhost:3000` → dùng `/api/*` hoặc biến `VITE_API_URL`.
4. Không tự commit/push/deploy — chỉ khi chủ repo yêu cầu.
5. Không xóa/sửa test đang pass để "đỏ thành xanh" — fix code, không fix test.
6. Mỗi phiên: bắt đầu bằng đọc task → kết thúc bằng handoff đúng format.
7. Trao đổi giữa agent chỉ dùng handoff / bug report đúng format.