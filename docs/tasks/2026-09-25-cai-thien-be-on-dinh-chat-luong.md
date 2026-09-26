# Task — Cải thiện backend "ổn định & chất lượng": tự kết nối lại DB, health check chi tiết, log vận hành

- **Ngày:** 2026-09-25
- **Loại:** Code — thuần BE (API chỉ THÊM field additive, không đổi/bỏ field cũ — FE không cần sửa)
- **Nguồn yêu cầu:** Chủ repo — "cải thiện backend, theo hướng ổn định & chất lượng"

## 1. Mục tiêu & bối cảnh

Tăng độ ổn định runtime và khả năng quan sát (observability) của backend Express mà **không thêm
dependency, không đổi hành vi UI, không phá hợp đồng API hiện có**. Kiểm toán hiện trạng (2026-09-25)
cho thấy nền đã chắc: cấu trúc MVC gọn (`routes/` → `controllers/` → `models/` + `middleware/` +
`lib/`), config fail-fast bằng `parseInteger`/`ConfigError` (env sai → từ chối khởi động, không lộ
secret), SQL 100% placeholder với schema `app.*` theo `server/docs/DATABASE.md`, graceful shutdown,
rate limit 3 tầng, security headers, Brotli/Gzip + ETag, test `node:test` 0 dependency.

**Đối chiếu hiện trạng lúc viết spec (khác số liệu khảo sát ban đầu của lead):**
- Khảo sát của lead ghi nhận 63 test — 62 pass / 1 fail, với `server/test/database.test.js` dòng 234
  stale (kỳ vọng `FROM categories`).
- Chạy `npm test` thực tế (gốc repo, 2026-09-25): **65 test, 65 pass, 0 fail** (6 bộ: api, chat,
  chat-rate, database, repository-injection, security-hardening). Dòng 234 hiện **đã** là
  `/FROM app\.categories ORDER BY category_key ASC/` — khớp `listCategories()` trong
  `server/models/catalog.model.js` (schema `app.categories` theo `server/docs/DATABASE.md`).
  Tức test stale đã được sửa sau thời điểm khảo sát (task bảo mật chạy trước cũng đã thêm test mới).
- Hệ quả: **hạng mục (1) chuyển thành "kiểm chứng + bổ sung comment"** do tester thực hiện ở giai
  đoạn [4] — kết quả cuối luôn là: regex đúng `app\.categories` + có comment giải thích (xem AC1).

4 hạng mục được chọn xử lý trong phiên này (chi tiết mục 4):

1. **(tester)** Kiểm chứng/sửa test stale dòng 234 `database.test.js` + comment giải thích.
2. **(be-coder)** Tự kết nối lại DB khi mất kết nối runtime — hiện `ready` kẹt `false` sau lỗi pool,
   không probe lại, không log gì (im lặng).
3. **(be-coder)** `GET /api/health` chi tiết hơn: `node`/`memory`/`pool`/`checks` + deep mode đo
   độ trễ DB.
4. **(be-coder)** Log vận hành tốt hơn: `[slow]`, `bytes=`, quiet paths, log reconnect an toàn.

## 2. User story

1. Là **chủ cửa hàng**, tôi muốn website tự kết nối lại database khi Supabase/mạng trục trặc tạm
   thời, để không phải khởi động lại server giữa giờ bán hàng và không mất đơn.
2. Là **người vận hành**, tôi muốn `GET /api/health` báo Node version, bộ nhớ, trạng thái pool và
   độ trễ database (khi cần), để chẩn đoán sự cố nhanh mà không phải vào máy chủ.
3. Là **lập trình viên**, tôi muốn log đánh dấu request chậm, bớt nhiễu log health check và không
   bao giờ lộ credential trong log, để đọc log có ích và an toàn.

## 3. Luật nghiệp vụ & biên

1. **Không đổi hợp đồng API hiện có**: mọi path/field/response đang có giữ nguyên tên, kiểu, giá
   trị — chỉ ĐƯỢC THÊM field mới (additive). FE, `server/scripts/deploy.ps1`,
   `tools/scripts/verify-perf.mjs`, CI (curl `/api/health`) không cần sửa.
2. **Fail-fast lúc boot giữ nguyên**: `server/index.js` vẫn thoát mã 1 khi DB không kết nối được
   lúc start. Reconnect của hạng mục (2) CHỈ hoạt động sau khi boot thành công (lỗi pool lúc runtime).
3. **Môi trường test không đụng PostgreSQL thật**: `npm test` chạy memory model như hiện nay; test
   cho reconnect/health/log phải dùng pg giả lập (pattern `pgModule` như `server/test/database.test.js`)
   hoặc repository tiêm (pattern `configureServices` như `server/test/repository-injection.test.js`).
4. **Không treo process**: mọi timer của reconnect phải `.unref()` và bị clear trong `close()` —
   `node --test` phải kết thúc sạch sau khi chạy xong test.
5. **Log an toàn**: mọi dòng log mới (request/slow/reconnect) là 1 dòng `key=value`; TUYỆT ĐỐI
   không log `DATABASE_URL`, host, user, mật khẩu, SSL config hay nội dung query. Mã lỗi phải
   sanitize bằng pattern `/^[A-Z0-9_.-]{1,64}$/i` (như `server/index.js`); không khớp → `DB_ERROR`.
6. **Health là read-only**: deep ping không được thay đổi trạng thái `ready` hay bất kỳ state nào.
7. **0 dependency mới**; không sửa `package.json` (gốc + server), CI/CD, `.env`; chỉ `.env.example`
   được thêm env mới kèm comment tiếng Việt.
8. Biên **reconnect**: probe dùng đúng query `SELECT 1 AS ready`; delay luỹ thừa
   `min(minMs * 2^n, maxMs)`; chỉ 1 chuỗi probe tồn tại tại một thời điểm (lỗi kế tiếp không nhân
   bản chuỗi); sau `close()` không probe/log thêm; probe thất bại không tạo unhandled rejection.
9. Biên **health**: `pool=null` khi không có pool (memory/test mode); `databaseLatencyMs` chỉ xuất
   hiện khi `deep=1` (query `deep` phải bằng đúng chuỗi `1`); ping lỗi → `null` (không ném lỗi ra
   ngoài controller — Express 4 không tự bắt async error); `ok`/status 200–503 vẫn theo readiness
   flag như cũ — ping KHÔNG đổi status. Hai biên CÓ CHỦ Ý (flag lạc hậu, đã được chấp nhận):
   `ready=false` + ping thành công → vẫn 503 kèm số đo; `ready=true` + ping fail → vẫn 200 kèm
   `databaseLatencyMs: null`.
10. Biên **logger**: `duration_ms > LOG_SLOW_MS` (strictly greater — bằng đúng ngưỡng vẫn
    `[request]`); `bytes=` chỉ xuất hiện khi response có header `Content-Length` lúc finish
    (response nén kiểu chunked thì không có); quiet path khớp CHÍNH XÁC `req.path` (không tính
    query string, case-sensitive — `/api/health?deep=1` vẫn bị quiet); `LOG_QUIET_PATHS`
    unset/rỗng → default `/api/health` (muốn tắt hẳn quiet logging thì set path không tồn tại).
11. Env sai định dạng (bảng mục 4.4) → `ConfigError` ngay khi load/boot — không âm thầm dùng default.
12. `npm test` và `npm run verify` (gốc repo) phải pass khi bàn giao.

### 3.1 Hợp đồng API — `GET /api/health` (additive — ràng buộc BE)

- **Method/Path:** `GET /api/health` · **Deep mode:** `GET /api/health?deep=1` (query `deep` phải
  bằng đúng chuỗi `1`; `deep=0`, `deep=true`, `deep=`, lặp `deep=1&deep=1` → coi như không deep).
- **Headers:** giữ nguyên `Cache-Control: no-store` (cả 2 mode).
- **Status:** `200` khi readiness ok, `503` khi không — **giữ nguyên logic hiện tại**.

| Field | Kiểu | Nguồn / luật |
|---|---|---|
| `ok` *(cũ)* | boolean | readiness flag — giữ nguyên |
| `name` *(cũ)* | string | `"do-cu-quang-huy-api"` — giữ nguyên |
| `version` *(cũ)* | string | `PKG.version` — giữ nguyên |
| `uptime` *(cũ)* | integer giây | giữ nguyên |
| `time` *(cũ)* | ISO string | giữ nguyên |
| `database` *(cũ)* | `"connected"` \| `"disconnected"` | giữ nguyên |
| `error` *(cũ, chỉ 503)* | string | `"Cơ sở dữ liệu chưa sẵn sàng."` — giữ nguyên |
| `node` *(mới)* | string | `process.version` (vd `v22.9.0`) |
| `memory` *(mới)* | object | `{rss_mb, heap_used_mb, heap_total_mb}` — integer = `Math.round(bytes/1048576)` từ `process.memoryUsage()` (`rss`, `heapUsed`, `heapTotal`) |
| `pool` *(mới)* | object \| null | `{total, idle, waiting}` = `pool.totalCount/idleCount/waitingCount`; `null` khi không có pool (memory/test mode) |
| `checks` *(mới)* | object | `{"database": "connected" \| "disconnected"}` — luôn cùng giá trị field `database` cũ (cùng nguồn readiness) |
| `databaseLatencyMs` *(mới, chỉ `deep=1`)* | integer ≥ 0 \| null | làm tròn ms đo quanh `SELECT 1`; `null` khi ping lỗi hoặc không có pool (memory/test) |

**Mẫu (a) — production, DB ready, `GET /api/health?deep=1` → 200:**

```json
{
  "ok": true,
  "name": "do-cu-quang-huy-api",
  "version": "1.3.0",
  "uptime": 3600,
  "time": "2026-09-25T10:00:00.000Z",
  "database": "connected",
  "node": "v22.9.0",
  "memory": { "rss_mb": 128, "heap_used_mb": 45, "heap_total_mb": 66 },
  "pool": { "total": 3, "idle": 2, "waiting": 0 },
  "checks": { "database": "connected" },
  "databaseLatencyMs": 8
}
```

**Mẫu (b) — production, DB mất kết nối, `GET /api/health?deep=1` → 503:**

```json
{
  "ok": false,
  "name": "do-cu-quang-huy-api",
  "version": "1.3.0",
  "uptime": 3600,
  "time": "2026-09-25T10:00:00.000Z",
  "database": "disconnected",
  "node": "v22.9.0",
  "memory": { "rss_mb": 128, "heap_used_mb": 45, "heap_total_mb": 66 },
  "pool": { "total": 2, "idle": 0, "waiting": 1 },
  "checks": { "database": "disconnected" },
  "databaseLatencyMs": null,
  "error": "Cơ sở dữ liệu chưa sẵn sàng."
}
```

**Mẫu (c) — memory/test mode (`npm test`), `GET /api/health` và `?deep=1` → 200** (không ping, không SQL):

```json
{
  "ok": true,
  "name": "do-cu-quang-huy-api",
  "version": "1.3.0",
  "uptime": 1,
  "time": "2026-09-25T10:00:00.000Z",
  "database": "connected",
  "node": "v22.9.0",
  "memory": { "rss_mb": 90, "heap_used_mb": 40, "heap_total_mb": 58 },
  "pool": null,
  "checks": { "database": "connected" },
  "databaseLatencyMs": null
}
```

*(Mode thường không có `deep=1`: giống mẫu tương ứng nhưng KHÔNG có field `databaseLatencyMs`.)*

**Mã lỗi:** chỉ `200`/`503` như hiện tại — không thêm status mới; `503` vẫn kèm `error` cũ. Lỗi hệ
thống khác đã do error handler chung xử lý (500 JSON `{error}`, không lộ stack).

## 4. Thay đổi đề xuất (4 hạng mục)

| # | Vị trí | Thay đổi | Lý do |
|---|---|---|---|
| 1 | `server/test/database.test.js` (dòng 234) — **tester, giai đoạn [4]** | Kiểm chứng regex đã là `/FROM app\.categories ORDER BY category_key ASC/` + bổ sung comment giải thích schema `app.*`; nếu regression thì sửa regex về đúng | Test phải khớp code đúng (schema `app` theo DATABASE.md); theo định tuyến "test sai → tester tự sửa test" (AGENTS.md mục 4) |
| 2 | `server/lib/db.js` | Tự probe kết nối lại khi pool lỗi lúc runtime (backoff luỹ thừa; timer `unref()` + clear khi close) | DB restart/mất mạng hiện làm `ready` kẹt `false` cho tới khi có traffic — không tự phục hồi, không log |
| 3 | `server/controllers/health.controller.js` + `server/models/index.js` + `server/app.js` + `server/lib/db.js` | Health chi tiết: thêm `node`, `memory`, `pool`, `checks` (additive) + deep mode `?deep=1` đo `databaseLatencyMs` | Endpoint vận hành nghèo thông tin, khó chẩn đoán sự cố |
| 4 | `server/middleware/request-logger.js` + `server/lib/db.js` | Prefix `[slow]`, thêm `bytes=`, quiet paths, log reconnect 1 dòng key=value an toàn | Log dễ đọc, bớt nhiễu, không lộ secret |

### 4.1 Hạng mục (2) — Tự kết nối lại DB khi mất kết nối runtime (`server/lib/db.js`)

Hiện trạng: `createDatabase()` chỉ flip biến `ready` trên `pool.on('error')` / `pool.on('connect')`.

Thiết kế:

1. Env mới đọc trong `createConfig()` (validate bằng `parseInteger` sẵn có — sai → `ConfigError`
   fail-fast lúc boot): `DB_RECONNECT_MIN_MS` (default 2000, khoảng 100–60000) và
   `DB_RECONNECT_MAX_MS` (default 30000, khoảng 1000–600000); nếu MIN > MAX → `ConfigError`
   (`'DB_RECONNECT_MIN_MS phải nhỏ hơn hoặc bằng DB_RECONNECT_MAX_MS.'`).
2. `createDatabase({ pgModule, config, reconnect, log })` — thêm option, caller hiện có không đổi:
   - `reconnect: { enabled, minMs, maxMs }` — mặc định `enabled = !IS_TEST` (`IS_TEST` từ
     `server/config.js`); `minMs`/`maxMs` lấy từ config nếu có, default 2000/30000; `minMs > maxMs`
     → `ConfigError`. Option này để unit test bật reconnect + delay ngắn (ms) mà không chờ thật.
   - `log` — hàm ghi log (mặc định dùng `console`), để test bắt nội dung log.
3. Khi pool phát `error`: `ready = false` ngay; log 1 dòng `[database] pool_error code=<code>`;
   nếu reconnect bật + chưa close + chưa có probe đang chờ → hẹn probe đầu tiên sau `minMs`.
   Lỗi kế tiếp khi probe đã chờ: vẫn log 1 dòng nhưng KHÔNG nhân bản chuỗi probe.
4. Probe chạy `pool.query('SELECT 1 AS ready')`:
   - Thành công → `ready = true`; clear timer; reset backoff; log
     `[database] reconnect_ok attempt=<n>`.
   - Thất bại → log `[database] reconnect_fail attempt=<n> code=<code> next_delay_ms=<d>`; hẹn
     tiếp với delay `min(minMs * 2^<attempt>, maxMs)` (default: 2000 → 4000 → 8000 → 16000 →
     30000 → 30000…); `d` không bao giờ vượt `maxMs`.
   - Toàn bộ được try/catch — không unhandled rejection; sau `close()` không probe/log thêm.
5. Mọi timer `.unref()`; `close()` clear timer TRƯỚC `pool.end()`. Hành vi `connect()` / `close()`
   / `isReady()` hiện tại giữ nguyên. Boot fail-fast KHÔNG đổi (luật 2); môi trường test mặc định
   TẮT reconnect (luật 3–4).
6. Thêm method `async ping()` (của database runtime): đo bằng `process.hrtime.bigint()` quanh
   `SELECT 1 AS ready`, trả số ms (float); ném lỗi nếu query fail — dùng cho health deep mode (4.2).

### 4.2 Hạng mục (3) — Health check chi tiết (`server/controllers/health.controller.js` + wiring)

Response theo hợp đồng 3.1 (CHỈ THÊM field). Cách triển khai đề xuất:

1. `server/lib/db.js`: thêm `ping()` (mục 4.1.6).
2. `server/models/index.js`: `configureServices()` chấp nhận thêm 2 field OPTIONAL:
   `poolStats` (hàm trả `{total, idle, waiting}` hoặc `null`) và `pingDatabase` (async hàm trả
   ms). Object KHÔNG có 2 field này vẫn hợp lệ như cũ — các test repository-injection không phải
   sửa. `models` xuất thêm `getPoolStats()` (trả object hoặc `null`, KHÔNG ném lỗi) và
   `getDatabasePing()` (trả hàm hoặc `null`).
3. `server/app.js` — chỉ nhánh production của `startServer()` (chạy khi `!IS_TEST`), truyền thêm
   vào `configureServices`:
   `poolStats: () => ({ total: database.pool.totalCount, idle: database.pool.idleCount, waiting: database.pool.waitingCount })`
   và `pingDatabase: async () => database.ping()`.
4. `server/controllers/health.controller.js`: handler thành async; xác định deep bằng
   `String(req.query.deep ?? '') === '1'`; nếu deep + có `getDatabasePing()` →
   `try { databaseLatencyMs = Math.max(0, Math.round(await ping())); } catch { databaseLatencyMs = null; }`
   — KHÔNG để lỗi thoát ra ngoài handler (Express 4 không tự bắt async error → sẽ rơi fatal
   handler). Ghép body: field cũ giữ nguyên, thêm `node`, `memory`, `pool: getPoolStats()`,
   `checks: { database: … }`; chỉ thêm `databaseLatencyMs` khi deep; `error` cũ chỉ khi 503.

(Cơ chế 1–4 là gợi ý thiết kế — be-coder có thể điều chỉnh nội bộ, miễn giữ hợp đồng API 3.1,
tính additive và chữ ký `configureServices` vẫn nhận object cũ không có field mới.)

### 4.3 Hạng mục (4) — Cải thiện log (`server/middleware/request-logger.js`)

Refactor theo pattern `server/middleware/rate-limit.js` (factory + default export):
`createRequestLogger({ slowMs, quietPaths, isTest, log })` — để test tiêm giá trị/bắt log;
`module.exports` vẫn là middleware mặc định, chữ ký `app.use(requestLogger)` trong `app.js` không đổi.

- **(a) Slow marker:** khi `duration_ms > LOG_SLOW_MS` → tiền tố dòng log là `[slow]` thay vì
  `[request]` (so sánh trên giá trị ms thô trước khi `toFixed(1)`; bằng đúng ngưỡng → `[request]`).
- **(b) Bytes:** khi response có header `Content-Length` lúc `finish` → thêm ` bytes=<giá trị>`
  CUỐI dòng (không có header → không thêm field; thứ tự field cũ giữ nguyên).
- **(c) Quiet paths:** `LOG_QUIET_PATHS` — danh sách path phân tách dấu phẩy (trim, bỏ entry
  rỗng); unset/rỗng → default `["/api/health"]`. Request có `req.path` khớp CHÍNH XÁC 1 path
  trong danh sách → KHÔNG log dòng request (query string không tính: `/api/health?deep=1` vẫn
  quiet). Middleware vẫn chạy đầy đủ: `X-Request-Id` vẫn được validate/sanitize/set như hiện tại.
- **(d) Log reconnect** trong `lib/db.js` theo mục 4.1 — 1 dòng key=value, không secret.
- Path vẫn sanitize `replace(/[\r\n]/g, '')` như hiện tại. `LOG_SLOW_MS` validate bằng
  `parseInteger` (default 1000, khoảng 50–3600000) ngay khi load module — sai giá trị → server
  từ chối khởi động (giống rate-limit hiện nay).

### 4.4 Env mới (chỉ thêm vào `server/.env.example`, kèm comment tiếng Việt)

| Env | Default | Phạm vi hợp lệ | Ý nghĩa |
|---|---|---|---|
| `DB_RECONNECT_MIN_MS` | `2000` | 100–60000 | Delay probe đầu tiên sau lỗi pool |
| `DB_RECONNECT_MAX_MS` | `30000` | 1000–600000 | Trần delay backoff (ràng buộc MIN ≤ MAX) |
| `LOG_SLOW_MS` | `1000` | 50–3600000 | Ngưỡng đánh dấu `[slow]` (ms) |
| `LOG_QUIET_PATHS` | `/api/health` | chuỗi path, phân tách phẩy | Path bỏ log dòng request |

### 4.5 Ngoài phạm vi phiên này (báo chủ repo)

- Metrics/alert ngoài (Prometheus, Sentry, JSON structured logging): cần duyệt thêm dịch vụ/dependency.
- README gốc còn ghi "61 test" (thực tế 65 lúc viết spec, sẽ tăng sau task này) — việc cập nhật
  con số để chủ repo quyết (tránh phải đuổi con số mỗi task).
- `react-router-dom` 6.x dính 2 CVE moderate — đã báo tại
  `docs/tasks/2026-09-25-tang-cuong-bao-mat-chieu-sau.md`, vẫn chờ duyệt upgrade (task FE riêng).
- Không đụng schema/migration database, không đổi pipeline deploy/CI.

## 5. Phạm vi file

- **Sửa:** `server/lib/db.js` (reconnect + `ping`), `server/controllers/health.controller.js`,
  `server/models/index.js`, `server/app.js` (chỉ nhánh production của `startServer` — truyền
  `poolStats`/`pingDatabase`), `server/middleware/request-logger.js` (factory + slow/bytes/quiet),
  `server/.env.example` (thêm 4 env + comment tiếng Việt), `README.md` (1–2 dòng mô tả health
  chi tiết/reconnect/log mới trong bảng BACKEND).
- **Thêm:** file task này; `server/test/observability.test.js` (test mới cho reconnect/health/log —
  `node:test`, pg/middleware giả lập, KHÔNG PostgreSQL thật);
  `docs/qa/2026-09-25-cai-thien-be-on-dinh-chat-luong.md` (tester, sau verify).
- **Sửa giới hạn hẹp:** `server/test/database.test.js` — CHỈ dòng 234 (regex + comment, hạng mục
  1, tester thực hiện ở [4]). be-coder chỉ được thêm key env mới (`DB_RECONNECT_MIN_MS`,
  `DB_RECONNECT_MAX_MS`) vào list cleanup `PG_ENV_KEYS` của helper `withEnv` nếu cần giữ test
  hermetic — cấm đụng bất kỳ assertion nào.
- **Không sửa:** `client/**`, `server/routes/**`, các middleware khác (security-headers,
  error-handler, cors, rate-limit, json-gzip…), `server/package.json` + `package.json` gốc,
  `.github/workflows/**`, `.env`, `server/database/**`, `server/scripts/**`.

## 6. Acceptance criteria (Given/When/Then)

### Hạng mục (1) — test stale (tester, giai đoạn [4])

1. **AC1 — Test khớp code:** Given `server/models/catalog.model.js` `listCategories()` truy vấn
   `app.categories` (schema `app` theo `server/docs/DATABASE.md`), When kiểm tra
   `server/test/database.test.js` dòng 234, Then assertion là
   `/FROM app\.categories ORDER BY category_key ASC/` và có comment giải thích ngay trên dòng
   (gợi ý: `/* app.categories: bảng nằm trong schema "app" (xem server/docs/DATABASE.md), không phải schema public */`).
   Tại thời điểm viết spec regex ĐÃ đúng, chỉ thiếu comment → tester bổ sung comment; nếu regex
   regression về dạng cũ (`FROM categories`) thì sửa về đúng + comment. Không sửa gì khác trong
   file ngoài dòng này và list `PG_ENV_KEYS` (mục 5). Test này phải pass trong `npm test`.

### Hạng mục (2) — tự kết nối lại DB khi mất kết nối runtime

2. **AC2 — Hạ readiness + log khi pool lỗi:** Given `createDatabase` chạy với reconnect bật,
   When pool phát event `error`, Then `isReady()` trả `false` ngay lập tức, có đúng 1 dòng log
   `[database] pool_error code=<code>` (code sanitize theo luật 5) và một probe
   `SELECT 1 AS ready` được hẹn chạy sau `DB_RECONNECT_MIN_MS`.
3. **AC3 — Backoff luỹ thừa có trần:** Given probe thất bại liên tục (pg giả lập reject), When
   mỗi lần fail, Then log `[database] reconnect_fail attempt=<n> code=<code> next_delay_ms=<d>`
   với dãy delay nhân đôi và bị chặn trên (default: 2000 → 4000 → 8000 → 16000 → 30000 → 30000…);
   không giá trị `next_delay_ms` nào vượt `DB_RECONNECT_MAX_MS`.
4. **AC4 — Phục hồi:** Given DB phục vụ lại (probe resolve), When probe kế tiếp chạy, Then
   `isReady()` trả `true`, log `[database] reconnect_ok attempt=<n>`, chuỗi probe dừng; lần pool
   lỗi kế tiếp sau đó bắt đầu lại từ `DB_RECONNECT_MIN_MS`.
5. **AC5 — close() dọn sạch, test không treo:** Given reconnect đang có timer chờ, When gọi
   `close()`, Then timer bị clear trước `pool.end()`, sau close không probe/log thêm và test
   `node --test` kết thúc sạch (process exit — không treo vì timer). Mọi timer reconnect đều `.unref()`.
6. **AC6 — Boot fail-fast giữ nguyên:** Given PostgreSQL không kết nối được lúc khởi động, When
   chạy `startServer()` (production), Then hành vi như hiện tại: log ngắn gọn (`[config]` /
   `[database] … code=…`) + process thoát mã 1 — reconnect không can thiệp giai đoạn boot.
7. **AC7 — Tắt mặc định trong môi trường test:** Given `IS_TEST=true` (npm test), When
   `createDatabase()` không tiêm option reconnect, Then reconnect mặc định TẮT (không timer,
   không probe); test riêng muốn chạy reconnect phải tiêm `reconnect: { enabled: true, minMs: <ngắn>,
   maxMs: <ngắn> }` + `pgModule` giả lập — không đụng PostgreSQL thật.
8. **AC8 — Validate env reconnect:** Given `DB_RECONNECT_MIN_MS`/`DB_RECONNECT_MAX_MS` sai kiểu
   (không nguyên), ngoài khoảng hợp lệ, hoặc MIN > MAX, When load config/boot, Then `ConfigError`
   fail-fast (thông báo tiếng Việt nêu tên biến — không lộ giá trị); ngược lại runtime dùng đúng
   giá trị env đã set.

### Hạng mục (3) — health check chi tiết

9. **AC9 — Field mới ở mode thường (production):** Given server production đã kết nối DB, When
   `GET /api/health`, Then 200 với đủ field cũ (`ok`, `name`, `version`, `uptime`, `time`,
   `database` — tên/kiểu/giá trị như cũ) + field mới `node` (string bắt đầu `v`), `memory`
   (`rss_mb`/`heap_used_mb`/`heap_total_mb` integer ≥ 0), `pool` (`total`/`idle`/`waiting`
   integer ≥ 0), `checks.database` — đúng hợp đồng 3.1, khớp JSON mẫu (a) trừ
   `databaseLatencyMs`; header `Cache-Control: no-store` giữ nguyên.
10. **AC10 — Deep mode đo độ trễ:** Given DB đang ready, When `GET /api/health?deep=1`, Then 200
    + `databaseLatencyMs` là integer ≥ 0 (khớp mẫu a); `node`/`memory`/`pool`/`checks` vẫn đầy đủ.
11. **AC11 — Deep mode khi DB down vẫn 503 + đủ field:** Given production mất kết nối DB, When
    `GET /api/health?deep=1`, Then status **503**, `ok=false`, `database` = `checks.database` =
    `"disconnected"`, `databaseLatencyMs=null`, `error="Cơ sở dữ liệu chưa sẵn sàng."`, các field
    mới vẫn đầy đủ (khớp mẫu b) — không thiếu field, không thêm status mới.
12. **AC12 — Memory/test mode không đụng PostgreSQL:** Given `npm test` (memory model), When
    `GET /api/health` và `GET /api/health?deep=1`, Then 200 + `pool=null` + `databaseLatencyMs=null`
    (khớp mẫu c) và KHÔNG có query SQL nào được gọi.
13. **AC13 — Chỉ `deep=1` mới là deep:** Given query `deep=0`, `deep=true`, `deep=` (rỗng), lặp
    `deep` hoặc không có, When GET `/api/health?...`, Then response như mode thường: KHÔNG có
    field `databaseLatencyMs`, KHÔNG ping DB.
14. **AC14 — Ping lỗi không làm sập server:** Given `pingDatabase` ném lỗi (pg giả lập reject /
    timeout), When `GET /api/health?deep=1`, Then response vẫn trả đầy đủ với
    `databaseLatencyMs=null` (status theo `ok` như logic cũ), process không crash, không rơi fatal
    handler — controller tự try/catch vì Express 4 không bắt async error.
15. **AC15 — Additive, consumer cũ không vỡ:** Given các consumer hiện có đọc `ok`/`name`/
    `version`/`uptime`/`database` (FE, `server/scripts/deploy.ps1`, `tools/scripts/verify-perf.mjs`,
    CI `curl -sf /api/health`, test api/repository-injection đang pass), When health trả response
    mới, Then không consumer nào phải sửa — mọi test đang pass liên quan health vẫn pass nguyên vẹn.

### Hạng mục (4) — log vận hành

16. **AC16 — Định dạng cũ giữ nguyên + bytes:** Given request hoàn tất (ngoài môi trường test),
    When log dòng request, Then có đúng 1 dòng `[request] id=<id> method=<m> path=<p> status=<s>
    duration_ms=<d>` — nếu response có header `Content-Length` thì THÊM ` bytes=<n>` ở cuối dòng;
    response không có header (vd nén kiểu chunked) → không có `bytes=`.
17. **AC17 — Slow marker:** Given `LOG_SLOW_MS=1000`, When một request kéo dài hơn 1000ms, Then
    dòng log của chính request đó có tiền tố `[slow]` (phần còn lại giữ format); When request mất
    đúng 1000.0ms hoặc nhanh hơn, Then tiền tố vẫn `[request]`.
18. **AC18 — Quiet path vẫn gắn X-Request-Id:** Given path nằm trong `LOG_QUIET_PATHS` (default
    `/api/health` — kể cả `/api/health?deep=1`), When request hoàn tất, Then KHÔNG có dòng log
    request nào cho path đó, nhưng response vẫn có header `X-Request-Id` hợp lệ (giữ nguyên logic
    validate/sanitize request id hiện tại).
19. **AC19 — Validate LOG_SLOW_MS:** Given `LOG_SLOW_MS` không phải số nguyên hoặc < 50, When
    server khởi động, Then `ConfigError` fail-fast; unset → dùng default 1000.
20. **AC20 — Log không chứa secret:** Given mọi dòng log mới (request/slow/pool_error/
    reconnect_fail/reconnect_ok), When soi nội dung, Then chỉ chứa `key=value` an toàn (id,
    method, path đã sanitize, status, duration_ms, bytes, code, attempt, next_delay_ms) —
    KHÔNG chứa `DATABASE_URL`, host, username, mật khẩu, SSL config, nội dung query; path chứa
    `\r\n` vẫn bị strip như hiện tại.

### Chung — không regression

21. **AC21 — Test không regression:** Given code hoàn tất, When chạy `npm test` (gốc repo), Then
    0 fail: toàn bộ test hiện hữu lúc viết spec (65 test) vẫn pass — không test cũ nào chuyển từ
    pass sang fail, không test cũ nào bị sửa ngoài dòng 234 / list `PG_ENV_KEYS` (mục 5) — và toàn
    bộ test mới cho hạng mục (2)(3)(4) pass.
22. **AC22 — Verify gate:** When chạy `npm run verify` (gốc repo), Then pass (test + build FE);
    thay đổi nằm đúng phạm vi file mục 5 — đặc biệt `package.json` gốc + `server/package.json`,
    `.github/workflows/**`, `.env`, `client/**` không đụng; 0 dependency mới.

### Gợi ý viết test mới (`server/test/observability.test.js` — do be-coder ở [2])

- **Reconnect:** dựng `pgModule` giả theo pattern `server/test/database.test.js` (pool giả có
  `query` điều khiển resolve/reject, `on` lưu handler, `end` ghi nhận); gọi
  `createDatabase({ pgModule, config, reconnect: { enabled: true, minMs: 20, maxMs: 80 }, log: captured })`;
  phát `error` → assert `isReady()=false`, probe đúng query `'SELECT 1 AS ready'`, có dòng
  `pool_error`; reject 2 lần → assert delay tăng dần (cho phép sai số, không so tuyệt đối ms);
  resolve → assert `isReady()=true` + `reconnect_ok`; `close()` → assert không probe thêm và
  test tự kết thúc sạch.
- **Health:** theo pattern `server/test/repository-injection.test.js` — `configureServices` với
  `isReady`/`poolStats`/`pingDatabase` giả lập; kiểm GET thường, `?deep=1` (ping resolve → số,
  ping reject → null), `isReady=false` (503, đủ field), memory mode (không tiêm `poolStats` →
  `pool=null`). Mỗi test tự `configureServices` đầy đủ trước khi gọi (state module dùng chung
  trong file). Dùng `fetch` + `app.listen(0)` như test hiện có.
- **Logger:** dựng express app riêng `app.listen(0)` với middleware từ
  `createRequestLogger({ isTest: false, slowMs, quietPaths, log: captured })`; route set
  `Content-Length` để test `bytes=`; route delay để test `[slow]`; quiet path → assert captured
  rỗng nhưng response header vẫn có `X-Request-Id`.
- **Env fail-fast:** copy pattern helper `withEnv` từ `database.test.js` — set
  `DB_RECONNECT_MIN_MS=abc`, `LOG_SLOW_MS=10`… → expect `ConfigError` khi gọi `createConfig()` /
  load module.
- Mọi test không cần PostgreSQL thật, không network ngoài, kết thúc sạch (không timer treo).

## 7. Phân vai theo quy trình 4 giai đoạn

- **[1] analyst:** file này (đã đối chiếu hiện trạng bằng `npm test` — 65/65 pass, xem mục 1).
- **[2] be-coder:** thực hiện hạng mục (2)(3)(4) theo mục 4.1–4.4 + viết test mới
  `server/test/observability.test.js` (theo gợi ý cuối mục 6); cập nhật `server/.env.example`
  (4 env + comment tiếng Việt) và `README.md` (1–2 dòng mô tả health chi tiết/reconnect/log);
  `npm test` pass toàn bộ mới bàn giao, kèm request/response mẫu đã chạy được (nếu máy có DB:
  `curl http://localhost:3000/api/health` và `curl "http://localhost:3000/api/health?deep=1"`;
  nếu không có DB thật thì dán output test có in JSON mẫu tương đương).
- **[3] fe-coder:** **bỏ qua** (task thuần BE — API additive, FE không cần sửa, không đổi UI) —
  ghi rõ trong handoff.
- **[4] tester:** xử lý hạng mục (1) (dòng 234 `database.test.js` + comment — AC1); đối chiếu
  TỪNG AC1–AC22; chạy `npm run verify` (gate bắt buộc; `npm run smoke` không bắt buộc vì không
  đổi UI — chỉ chạy nếu có môi trường server + DB thật); PASS → ghi
  `docs/qa/2026-09-25-cai-thien-be-on-dinh-chat-luong.md` + báo DONE; FAIL → bug report đúng
  format AGENTS.md mục 4 (định tuyến: UI/logic FE → fe-coder · API/data/lỗi 500 → be-coder ·
  nghiệp vụ mơ hồ → analyst · test sai → tester tự sửa test).

## 8. Bàn giao

```text
[HANDOFF] analyst -> be-coder
Task: docs/tasks/2026-09-25-cai-thien-be-on-dinh-chat-luong.md · Status: DONE
Artifacts: file task này · Verify: npm test (gốc repo) → 65/65 pass lúc viết spec (đối chiếu hiện trạng dùng cho phân tích, không phải verify của giai đoạn [2])
Next: be-coder thực hiện hạng mục (2)(3)(4) + test mới theo AC2–AC22 (AC1 dành cho tester ở [4]); sau đó tester verify toàn bộ AC và chạy npm run verify
```







