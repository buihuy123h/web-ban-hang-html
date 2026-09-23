# 2026-09-22 — Tối ưu toàn bộ dự án: nén ảnh JPG, Brotli cho API, micro-opt FE

> **Task ID chia sẻ:** `task_0001` · **Tạo bởi:** analyst (giai đoạn [1] ANALYZE) · **Trạng thái tài liệu:** READY — be-coder & fe-coder code được ngay, không cần hỏi lại nghiệp vụ.
> **Quy trình:** [1] ANALYZE (tài liệu này) → [2] BACKEND `be-coder` → [3] FRONTEND `fe-coder` → [4] QA `tester` (đối chiếu từng AC ở mục 7).

## 1. Mục tiêu & bối cảnh

Chủ repo yêu cầu **"tối ưu toàn bộ dự án"**. Khảo sát baseline 2026-09-22 cho thấy phần lớn đã tốt — chỉ còn **3 điểm** mang lại lợi ích thực tế:

1. **Ảnh JPG quá to so với nhu cầu hiển thị** — 5 file JPG trong `server/public/images/` có bề rộng 1200–1774px nhưng mọi nơi dùng chỉ hiển thị ~400–800px (background CSS + hero ~800px). Tổng dung lượng **1.008 KB** (bảng chi tiết mục 6).
2. **API JSON chỉ nén gzip** — middleware nén JSON trong `server/server.js` (khối *"Gzip + ETag/304 cho phản hồi JSON của API"*, dòng ~172–208) dùng `zlib.gzipSync` + cache theo ETag. Node có sẵn `zlib.brotliCompressSync` → JSON nhỏ hơn ~15–20% so với gzip, **0 dependency**.
3. **Micro-opt FE** — `client/src/pages/Home.jsx` dòng 77: `products.filter((p) => p.badge === 'hot')` chạy lại mỗi render dù `products` không đổi → đưa vào `useMemo`.

**Đã tốt — KHÔNG tối ưu lại (ngoài phạm vi):** bundle FE đã lazy-load 7/8 trang + tách vendor chunk (index.css 38.9KB/gzip 8.4, index.js 37.2KB/gzip 13.6, vendor.js 164KB/gzip 53.5); static `/assets` đã có precompress Brotli/Gzip; security headers, rate limit, ETag/304, atomic writes, keep-alive.

**Ràng buộc cứng (AGENTS.md):** không thêm dependency mới (nén ảnh dùng PowerShell System.Drawing built-in; nén JSON dùng `zlib` có sẵn của Node); **không đổi API contract**; không sửa test đang pass; không commit/push — chủ repo review sau khi QA PASS.

## 2. User story

- **Là chủ cửa hàng**, tôi muốn trang tải nhanh hơn (ảnh nhẹ hơn một nửa, JSON API nhỏ thêm 15–20%) để khách dùng 4G/mạng yếu mở danh mục không bỏ cuộc giữa chừng — mà không phải đổi giao diện, dữ liệu hay đường dẫn nào.
- **Là khách hàng** trên máy đời thấp, tôi muốn ảnh hero và ảnh danh mục tải xong trong 1–2 giây để xem hàng ngay, không nhìn ô xám chờ đợi.
- **Là tester**, tôi muốn bộ test API phủ đủ 3 nhánh nén (br / gzip / không nén) để bảo đảm mọi trình duyệt — có hoặc không có Brotli — vẫn nhận đúng dữ liệu như cũ.

## 3. Luật nghiệp vụ

### 3.1 Ảnh — CHỐT phương án (a): giữ nguyên tên file, ghi đè nội dung nén

**Quyết định:** nén/resize **tại chỗ, giữ nguyên 100% tên file + đường dẫn**. KHÔNG đổi tên file, KHÔNG sửa `server/data/products.json`, `client/index.html`, `client/src/data/productImages.js`.

**Lý do chốt (a) thay vì (b) đổi tên file:**
- Dự án **chưa lên mạng thật** → không có khách thật đang giữ cache 30 ngày; rủi ro chỉ nằm ở máy dev/QA local và xử lý được bằng hard refresh (Ctrl+F5) hoặc xoá cache — chấp nhận được.
- Phạm vi thay đổi nhỏ nhất: không đụng dữ liệu (`products.json`), preload hero ở `client/index.html` dòng 21 trỏ `/images/catalog/noi-chao.jpg` vẫn đúng, không vỡ bất kỳ tham chiếu nào (DB, CSS `App.css` dòng 57, `productImages.js`).
- `server/docs/DATABASE.md` mục 5 quy ước *"thay ảnh = thêm file mới + sửa đường dẫn, không ghi đè"* — quy ước đó **vẫn nguyên vẹn cho mọi lần thay ảnh từ sau task này**. Lần này là **ngoại lệ một lần**, vì: (1) chưa có client thật, (2) không đổi nội dung bức ảnh — chỉ nén lại chính bức ảnh đó.

**Rủi ro đã chấp nhận:** trình duyệt đã tải ảnh cũ sẽ còn thấy ảnh cũ tối đa 30 ngày (`Cache-Control: immutable` cho `/images/*`). **QA PHẢI hard refresh (Ctrl+F5) khi kiểm thử UI.** Ghi chú tương lai: khi dự án lên mạng thật, mọi thay đổi ảnh PHẢI theo quy ước tên file mới của `DATABASE.md` — không ghi đè nữa.

### 3.2 Quy tắc nén ảnh (script PowerShell, 0 dependency)

Script mới: `server/scripts/optimize-images.ps1`, dùng **System.Drawing** (built-in Windows). Chạy từ gốc repo:

```powershell
powershell -ExecutionPolicy Bypass -File server\scripts\optimize-images.ps1   # tham số: -MaxWidth 800 -Quality 75
```

| # | Luật |
|---|---|
| A1 | Chỉ xử lý file `*.jpg` (duyệt đệ quy `server/public/images/`) có **Width > MaxWidth (800)**. File `.svg` và ảnh đã ≤ 800px: **bỏ qua, không re-encode** → script **idempotent**, chạy lại không làm giảm chất lượng thêm. |
| A2 | Resize: Width → 800, Height giữ đúng tỉ lệ khung (làm tròn, sai số ≤ 2px). **Không bao giờ phóng to** ảnh nhỏ hơn. |
| A3 | Re-encode JPEG **quality 75**. Nếu sau chạy tổng 5 ảnh giảm < 40% → được phép hạ quality tối thiểu **70** rồi chạy lại từ backup (A4). Dưới 70 là không được — dừng và báo analyst. |
| A4 | **Backup trước khi ghi đè:** chép bản gốc sang `server/scripts/backup-images/` giữ cấu trúc `catalog/`, `products/`. Nếu file backup đã tồn tại mà khác nội dung → lưu thêm bản có hậu tố thời gian, tuyệt đối không đè mất backup gốc đầu tiên. |
| A5 | Chỉ ghi đè khi file nén **nhỏ hơn** bản gốc; nếu nén ra to hơn (hiếm) → giữ nguyên file cũ và báo cáo "skip". |
| A6 | **EXIF Orientation:** nếu ảnh có thuộc tính Orientation ≠ 1 → áp dụng RotateFlip tương ứng trước khi resize rồi reset về 1 (chống ảnh bị lật/ngửa sau khi re-save). |
| A7 | Mở ảnh từ bản sao stream (MemoryStream), không khoá file nguồn khi ghi. File hỏng/không đọc được → cảnh báo + bỏ qua, không crash cả script; kết thúc với exit code ≠ 0 nếu có bất kỳ file nào lỗi. |
| A8 | In báo cáo cuối: từng file (tên, px cũ→mới, KB cũ→mới) + **tổng before/after** — dán nguyên vào handoff. |

**Ghi chú hiển thị:** `noi-chao.jpg` còn được dùng làm background `.page-hero::after` (`client/src/App.css` dòng 57, background-size `170% auto`). Nếu chủ repo thấy dải banner này mềm hơn trước, được phép re-run từ backup với `-MaxWidth` lớn hơn cho riêng file đó — quyết định thuộc chủ repo, báo analyst cập nhật tài liệu này. Mặc định task này: mọi ảnh về 800px.

### 3.3 Brotli cho phản hồi JSON của API

Sửa **duy nhất khối middleware nén JSON** trong `server/server.js` (khối *"Gzip + ETag/304 cho phản hồi JSON của API"*, dòng ~172–208). Mọi hành vi khác của khối giữ nguyên.

**B1 — Chọn encoding, thứ tự ưu tiên: `br` > `gzip` > không nén.**
- `Accept-Encoding` chứa token `br` → nén brotli; chỉ chứa `gzip` → gzip **như cũ**; không hỗ trợ cả hai → đi qua `next()` (body thường) như hiện tại.
- So khớp theo **token** (tách theo dấu phẩy, bỏ tham số `;q=…`) — đúng kiểu helper `acceptsEncoding` đã có cho static `/assets` (dòng ~449); có thể đưa helper lên dùng chung thay `.includes('gzip')` hiện tại.
- **Đơn giản hoá có chủ đích (biên):** không parse q-value — `Accept-Encoding: br;q=0` vẫn coi là hỗ trợ br. Nhất quán với static `/assets` hiện có; mọi trình duyệt thực tế đều gửi token thường, không gửi q=0.

**B2 — Cache 2 biến thể:** cache hiện có (`gzipCache`, key = ETag hash nội dung, tối đa 64 mục, LRU) mở rộng: mỗi ETag lưu được **cả bản gzip lẫn bản br**, tính lazily theo encoding được chọn. Không tách Map riêng, không đổi cách tạo ETag (`makeEtag` — sha1 nội dung).

**B3 — Giữ nguyên:** ngưỡng body **≥ 1024 bytes** mới nén (nhỏ hơn → `res.json` gốc, Express tự lo ETag); ETag theo nội dung → **giống nhau ở mọi encoding**; kiểm tra `If-None-Match` → **304 trước khi nén**; header `Content-Type: application/json; charset=utf-8`, `Vary: Accept-Encoding` (đã có), `Content-Encoding` đúng biến thể.

**B4 — Nén:** `zlib.brotliCompressSync(body)` (quality mặc định — chỉ tốn 1 lần cho mỗi ETag vì đã cache). Nếu đo thấy lần đầu chậm rõ rệt với body lớn → được phép hạ `BROTLI_PARAM_QUALITY` về 5, không cần hỏi lại. Nếu brotli lỗi bất thường → fallback gzip, tuyệt đối không để server crash.

**Bảng trường hợp biên (đối chiếu được bằng request thật):**

| Client gửi `Accept-Encoding` | Kết quả phải nhận |
|---|---|
| `br` | 200 + `Content-Encoding: br` |
| `gzip` | 200 + `Content-Encoding: gzip` (như cũ) |
| `gzip, br` · `br, gzip` · `gzip, deflate, br` | 200 + `br` (ưu tiên) |
| không gửi header · `deflate` · `identity` | 200, **không có** `Content-Encoding` |
| `br` nhưng body < 1KB (vd `/api/health`) | không nén (giữ ngưỡng ≥ 1KB) |
| `If-None-Match` khớp ETag (kèm br hoặc gzip) | 304, không body |
| response lỗi 400/404/429 | body < 1KB → không nén; ≥ 1KB → nén như body thường |

### 3.4 FE — Home.jsx (toàn bộ phạm vi FE)

- Đưa `products.filter((p) => p.badge === 'hot')` (dòng 77) vào `useMemo(..., [products])` (nhớ thêm `useMemo` vào import React).
- Cập nhật thuộc tính `<img>` hero (dòng 168, hiện `width={1774} height={887}`) thành **`width={800} height={400}`** — khớp kích thước thật mới của `noi-chao.jpg` sau nén; tỉ lệ 2:1 giữ nguyên nên không CLS.
- **Không đổi gì khác** ở FE. Ghi nhận ngoài phạm vi: `Saved.jsx` dòng 20 cũng có filter `badge === 'hot'` tương tự — **ai thấy cũng không tự sửa**, để task riêng nếu chủ repo muốn.

### 3.5 Giữ nguyên tuyệt đối (không đụng)

Security headers · CORS · rate limit · cơ chế ETag/304 JSON · atomic writes đơn hàng · keep-alive · static `/assets` + `scripts/precompress.js` (đã có br) · cache ảnh 30 ngày immutable · toàn bộ path/query/field/response shape của API · `server/data/products.json` · CI/CD `.github/workflows/` · `package.json` gốc · cấu hình build Vite.

## 4. Hợp đồng API — KHÔNG đổi (ràng buộc cả BE lẫn FE)

| Endpoint | Hành vi hiện tại | Thay đổi trong task này |
|---|---|---|
| `GET /api/health` | `{ok, name, version, uptime, time}` | Không |
| `GET /api/categories` | mảng `{key, label, image}` | Không |
| `GET /api/products` (`?cat`, `?q`, `?sort=`) | mảng sản phẩm đủ trường | Không |
| `GET /api/products/:id` | `{product, related}` / 404 `{error}` | Không |
| `POST /api/orders` | validate → 201 `{order}` / 400 `{error, fields}` | Không |
| `GET /images/*` | file ảnh + `Cache-Control: immutable` 30 ngày | Không (chỉ nội dung file nhẹ hơn) |

- Path, query, request body, response JSON shape, status code: **giữ 100%**. 21 test hiện tại phải pass **nguyên vẹn — không sửa/xoá dòng nào** (chỉ được *thêm* test mới).
- Điểm mở rộng trong suốt (không phá client): header `Content-Encoding` có thể là `br` thay vì `gzip` tuỳ `Accept-Encoding`. `fetch`/XHR tự giải nén → **FE không được đọc hoặc phụ thuộc vào `Content-Encoding`**; FE tiếp tục gọi `/api/*` qua lớp `client/src/api/`, không hardcode host.
- Tranh chấp hợp đồng BE↔FE → analyst chốt và cập nhật tài liệu này (AGENTS.md mục 3); không ai tự thay đổi.

## 5. Phạm vi & phân công

**BE (`be-coder`, `server/**`) — làm trước:**
1. Tạo `server/scripts/optimize-images.ps1` theo luật 3.2. Task này **cho phép ghi đè** file trong `server/public/images/` (ngoại lệ có chủ đích so với quy tắc thường ngày "chỉ thêm ảnh").
2. Chạy script → nén 5 ảnh; dán báo cáo before/after (A8) vào handoff.
3. `server/server.js`: thêm brotli theo luật 3.3 — chỉ khối middleware nén JSON.
4. `server/test/api.test.js`: **thêm ≥ 6 test mới** đúng danh sách mục 8.1; không đụng 21 test cũ.
5. `npm test` (trong `server/`) pass với ≥ 27 test. Không commit.

**FE (`fe-coder`, `client/**`) — không phụ thuộc BE, có thể làm song song:**
1. `client/src/pages/Home.jsx`: 2 thay đổi ở luật 3.4, không hơn.
2. `npm run build` pass. Không commit.

**QA (`tester`):** đối chiếu **từng** AC mục 7 · chạy `npm run verify` · smoke UI (Playwright, hard refresh) · ghi `docs/qa/2026-09-22-toi-uu-toan-bo-du-an.md` · PASS → báo DONE chủ repo, FAIL → bug report theo AGENTS.md mục 4.

**Ngoài phạm vi:** bundle JS/CSS (đã tối ưu) · WebP/AVIF (cần thư viện hoặc đổi tên file) · CDN/service worker · `Saved.jsx` · `DATABASE.md` (quy ước giữ nguyên, ngoại lệ đã ghi ở 3.1) · refactor BE khác.

## 6. Baseline & chỉ tiêu (số liệu gốc để so sánh — đo lại bằng lệnh ở mục 8.2)

| Chỉ số | Baseline 2026-09-22 | Chỉ tiêu sau task |
|---|---|---|
| Tổng 5 ảnh JPG | **1.008 KB** | **≤ 604 KB (giảm ≥ 40%)** |
| Độ phân giải ảnh | bề rộng 1200–1774px | mọi file ≤ 800px bề rộng |
| `npm test` (server) | 21/21 pass | **≥ 27/27 pass** (21 cũ nguyên vẹn + ≥ 6 mới) |
| `npm run build` (gốc repo) | pass | pass; gzip index-*.js ≤ 14.3 KB, vendor-*.js ≤ 56.2 KB (không tăng > 5%) |
| API JSON khi client gửi `Accept-Encoding: br` | chỉ gzip (không có br) | `Content-Encoding: br`, body giải nén ra JSON y hệt |

Bảng ảnh chi tiết (baseline):

| File (tại `server/public/images/`) | Kích thước | Dung lượng |
|---|---|---|
| catalog/bat-dia.jpg | 1200×900 | 157 KB |
| catalog/dung-cu.jpg | 1200×900 | 203 KB |
| catalog/luu-tru.jpg | 1200×900 | 226 KB |
| catalog/noi-chao.jpg (hero — preload `index.html` + `<img>` `Home.jsx`) | 1774×887 | 196 KB |
| products/ke-inox-4-tang.jpg | 1200×900 | 226 KB |
| **Tổng** | | **1.008 KB** |

## 7. Acceptance criteria — tester đối chiếu TỪNG mục (Given/When/Then)

**AC-1 · Ảnh giảm ≥ 40%, không đổi tham chiếu**
- Given: 5 ảnh JPG baseline tổng 1.008 KB tại `server/public/images/`.
- When: chạy `powershell -ExecutionPolicy Bypass -File server\scripts\optimize-images.ps1`.
- Then: tổng dung lượng ≤ 604 KB; tên file + đường dẫn không đổi; `git status` cho thấy `server/data/products.json`, `client/index.html`, `client/src/data/productImages.js`, `server/docs/DATABASE.md` **không** bị sửa.

**AC-2 · Ảnh đúng kích thước mới**
- Given: script đã chạy xong.
- When: đo bằng PowerShell System.Drawing (lệnh ở mục 8.2).
- Then: mọi file Width ≤ 800; tỉ lệ khung giữ nguyên (sai số ≤ 2px); không file nào bị phóng to; GET ảnh vẫn `Content-Type: image/jpeg`; nhìn bằng mắt: không nát/vỡ rõ rệt ở mức hiển thị ~800px.

**AC-3 · Backup + idempotent**
- Given: script đã chạy 1 lần.
- When: chạy script lần 2.
- Then: báo cáo ghi "0 file được xử lý"; tổng dung lượng 5 ảnh không đổi; `server/scripts/backup-images/` có đủ 5 bản gốc với dung lượng đúng bằng baseline (157/203/226/196/226 KB).

**AC-4 · Brotli hoạt động**
- Given: server BE đang chạy.
- When: `curl.exe -s -D - -o body.br -H "Accept-Encoding: br" http://localhost:3000/api/products`.
- Then: HTTP 200; header `Content-Encoding: br`; `zlib.brotliDecompressSync(body.br)` → JSON hợp lệ, deep-equal JSON nhận khi không nén.

**AC-5 · Ưu tiên br > gzip**
- Given: server BE đang chạy.
- When: gửi `Accept-Encoding: gzip, br` → rồi `br, gzip` → rồi `gzip, deflate, br`.
- Then: cả 3 lần đều nhận `Content-Encoding: br`.

**AC-6 · gzip như cũ (regression)**
- When: gửi `Accept-Encoding: gzip`.
- Then: `Content-Encoding: gzip`; `zlib.gunzipSync` → JSON y hệt (test hiện có "Phản hồi JSON lớn được nén gzip" vẫn pass nguyên vẹn).

**AC-7 · Không nén đúng chỗ**
- When: (a) không gửi `Accept-Encoding`; (b) chỉ gửi `deflate`; (c) gửi `br` nhưng body < 1KB (`/api/health`).
- Then: cả 3 trường hợp response **không có** header `Content-Encoding`, body JSON thường.

**AC-8 · ETag/304 + Vary**
- Given: response 200 của `/api/products` khi gửi `Accept-Encoding: br` có ETag và `Vary: Accept-Encoding`.
- When: gửi lại kèm `If-None-Match: <etag>` với `Accept-Encoding: br`, rồi với `Accept-Encoding: gzip`.
- Then: cả hai nhận 304; ETag của cùng một payload **giống nhau** ở mọi encoding (hash nội dung).

**AC-9 · Bộ test**
- Given: code BE đã xong.
- When: chạy `npm test` (trong `server/`).
- Then: PASS với **tổng ≥ 27 test**; `git diff` file test cho thấy 21 test cũ **nguyên vẹn, chỉ thêm mới**; bộ mới phủ đủ 6 hành vi mục 8.1.

**AC-10 · Build & bundle**
- When: chạy `npm run build` (gốc repo).
- Then: pass; trong `client/dist/assets/`: `index-*.js.gz` ≤ 14.3 KB và `vendor-*.js.gz` ≤ 56.2 KB (không tăng quá 5% so với baseline gzip 13.6 / 53.5 KB).

**AC-11 · FE code đúng phạm vi**
- When: đọc `git diff client/`.
- Then: **chỉ** `client/src/pages/Home.jsx` thay đổi, gồm đúng 2 điểm: filter hot nằm trong `useMemo(..., [products])`; `<img>` hero có `width={800} height={400}`. Không file FE nào khác đổi.

**AC-12 · UI hiển thị đúng sau nén**
- Given: BE + FE đang chạy (`npm run dev:server` + `npm run dev:client`).
- When: mở trang chủ + trang danh mục, **hard refresh (Ctrl+F5)**.
- Then: hero + ảnh danh mục hiển thị đầy đủ, không vỡ/nhòe bất thường; tab Network: các file `.jpg` trả 200 với dung lượng nhỏ hơn baseline.

## 8. Ghi chú triển khai

### 8.1 — 6 test mới bắt buộc (thêm vào `server/test/api.test.js`)
Dùng request thô bằng `node:http` (theo pattern `rawGet` của test hiện có *"Client build: bundle JS nén sẵn…"*) — vì `fetch` của Node tự giải nén nên không thấy được body/`Content-Encoding` thô. Có thể đưa helper `rawGet` ra dùng chung.
1. `Accept-Encoding: br` → 200 + `Content-Encoding: br`; `brotliDecompressSync` ra JSON deep-equal bản không nén.
2. `Accept-Encoding: gzip, br` và `br, gzip` → đều `br`.
3. `Accept-Encoding: gzip` → `gzip`; `gunzipSync` ra JSON đúng (regression).
4. Không gửi `Accept-Encoding` / chỉ `deflate` → không có `Content-Encoding`.
5. ETag: lấy ETag từ request br → gửi `If-None-Match` kèm AE `br` → 304; kèm AE `gzip` → 304; ETag hai encoding bằng nhau.
6. `Vary: Accept-Encoding` xuất hiện trên response br & gzip; `/api/health` (body < 1KB) không nén dù gửi AE `br`.

### 8.2 — Lệnh đo cho QA (chạy tại gốc repo)
```powershell
# 1) Tổng dung lượng 5 ảnh (baseline = 1008 KB, chặn ≤ 604 KB)
"{0:N1} KB" -f ((Get-ChildItem "server\public\images" -Recurse -Filter *.jpg |
  Measure-Object Length -Sum).Sum / 1KB)

# 2) Kích thước px từng ảnh (mọi file phải Width <= 800)
Add-Type -AssemblyName System.Drawing
Get-ChildItem "server\public\images" -Recurse -Filter *.jpg | ForEach-Object {
  $i = [System.Drawing.Image]::FromFile($_.FullName)
  "{0}: {1}x{2} ({3:N1} KB)" -f $_.Name, $i.Width, $i.Height, ($_.Length / 1KB); $i.Dispose()
}

# 3) Header Content-Encoding của API
curl.exe -s -D - -o NUL -H "Accept-Encoding: br"   http://localhost:3000/api/products
curl.exe -s -D - -o NUL -H "Accept-Encoding: gzip" http://localhost:3000/api/products

# 4) Bundle sau build (chặn: index <= 14.3 KB, vendor <= 56.2 KB)
Get-ChildItem "client\dist\assets\*.js.gz" | Select-Object Name, @{n='KB';e={"{0:N1}" -f ($_.Length/1KB)}}
```

### 8.3 — Gợi ý cốt lõi cho script ảnh (System.Drawing — tham khảo, miễn đúng luật 3.2)
- Quality JPEG: `EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, 75)` + codec `image/jpeg`.
- Resize: `Bitmap` mới + `Graphics` với `InterpolationMode = HighQualityBicubic`, `PixelOffsetMode = HighQuality`, `CompositingQuality = HighQuality`.
- Đọc ảnh qua `MemoryStream` (sao chép bytes) thay vì `Image::FromFile` để không khoá file khi ghi đè.

## 9. Quy trình bàn giao

1. **analyst** (xong — tài liệu này) → handoff **be-coder** (mục 5) → be-coder xong (kèm `npm test` pass + báo cáo ảnh before/after) → handoff **fe-coder** (luật 3.4) → fe-coder xong (kèm `npm run build` pass) → handoff **tester** (mục 7) → PASS → ✅ DONE, báo chủ repo.
2. FE không phụ thuộc BE (2 thay đổi `Home.jsx` không đụng API) — nếu chủ repo muốn rút ngắn thời gian thì fe-coder chạy song song với be-coder; mặc định theo thứ tự chuẩn.
3. Bug định tuyến theo AGENTS.md mục 4 (UI/FE → fe-coder · API/500/ảnh → be-coder · nghiệp vụ mơ hồ → analyst). Tranh chấp hợp đồng → analyst chốt và cập nhật file này.
4. Không ai commit/push — sau QA PASS, chủ repo review và tự quyết định commit.




