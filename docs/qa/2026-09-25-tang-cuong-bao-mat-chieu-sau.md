# QA — Tăng cường bảo mật chiều sâu (defense-in-depth)

- **Ngày:** 2026-09-25
- **Task:** `docs/tasks/2026-09-25-tang-cuong-bao-mat-chieu-sau.md`
- **Tester:** tester (Claude) · **Kết luận:** ✅ **PASS** — AC1–AC7 đạt, không có bug
- **Môi trường:** Windows + PowerShell, Node v24.11.1, memory-model (không gọi mạng ngoài, không đụng PostgreSQL — đúng luật test của repo)

## 1. Kết quả lệnh verify

| Lệnh | Kết quả |
|---|---|
| `npm run verify` | **EXIT=0** — `npm test` **65/65 pass, 0 fail** + `npm run build` ✓ (built 620ms, precompress 32 bản nén) |
| `node tools/scripts/verify-security-headers.cjs` | HOME=200 · IMG=200 (`image/jpeg`, `cache public, max-age=2592000, immutable`) · API=200 |

Script `tools/scripts/verify-security-headers.cjs` (thêm mới cho QA) boot app memory-model phục vụ đúng **client build thật** + ảnh tĩnh, cho phép đối chiếu header trên server chạy thật mà không cần PostgreSQL.

## 2. Đối chiếu acceptance criteria

| AC | Kỳ vọng | Bằng chứng | Kết quả |
|---|---|---|---|
| **AC1** | CSP `img-src 'self' data:`, **không** có `https:` trong directive img-src | Test `CSP siết img-src…` pass (extract directive rồi so khớp chuỗi chính xác); header thật từ script: `img-src 'self' data:` | ✅ |
| **AC2** | CSP chứa `connect-src 'self'` | Header thật: `connect-src 'self'` + assert trong test | ✅ |
| **AC3** | Mọi response có `Cross-Origin-Resource-Policy: same-origin` | Script check trên HTML → `CORP=same-origin`; test assert trên `/api/health`; ảnh tĩnh cũng mang CORP | ✅ |
| **AC4** | `Permissions-Policy` chứa 8 directive cơ bản `=()` | Header thật có **12** directive (đủ 8 yêu cầu + `display-capture, accelerometer, gyroscope, magnetometer`) | ✅ |
| **AC5** | Lỗi có `status` chuỗi/200/999 → **500** JSON generic, không lộ chi tiết; status hợp lệ (409) giữ nguyên | Test mini-app 4 case: `/api/str`→500, `/api/ok`→500, `/api/999`→500, `/api/real`→409; body luôn `{error:'Lỗi máy chủ…'}` + `no-store`; response không chứa chuỗi lỗi nội bộ | ✅ |
| **AC6** | Không regression: toàn bộ test pass, build exit 0, không sửa test cũ | 65/65 pass (63 cũ nguyên vẹn + 2 test mới **append cuối file** `security-hardening.test.js`); build exit 0 | ✅ |
| **AC7** | UI không vỡ: ảnh `/images/*`, font Google, iframe Maps vẫn tải được | (a) Build pass; (b) script verify: HTML 200, ảnh `/images/catalog/bat-dia.jpg` 200 immutable — ảnh same-origin nằm trong `img-src 'self'`; (c) CSP vẫn giữ whitelist `style-src …fonts.googleapis.com`, `font-src …fonts.gstatic.com`, `frame-src …www.google.com maps.google.com`; (d) `connect-src 'self'` khớp cách FE gọi API (`/api/*` cùng origin, không hardcode host ngoài) | ✅ |

### Bằng chứng header thực tế (trích `tools/scripts/verify-security-headers.cjs`)

```text
HOME=200
CSP=default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-src 'self' https://www.google.com https://maps.google.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
CORP=same-origin
PP=camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), serial=(), idle-detection=(), display-capture=(), accelerometer=(), gyroscope=(), magnetometer=()
IMG=200 type=image/jpeg cache=public, max-age=2592000, immutable
API=200 len=10067
```

## 3. File thay đổi (đối chiếu phạm vi task §5)

| File | Thay đổi |
|---|---|
| `server/middleware/security-headers.js` | Mục 1–4: siết `img-src`, thêm `connect-src`, thêm CORP, mở rộng Permissions-Policy (12 directive) |
| `server/middleware/error-handler.js` | Mục 5: whitelist `err.status` integer 400–599, còn lại → 500 |
| `server/test/security-hardening.test.js` | **Chỉ thêm** 2 test mới ở cuối file (AC1–AC4, AC5); không sửa test đang pass |
| `README.md` | 1 dòng mô tả middleware (thêm CORP + Permissions-Policy mở rộng) |
| `tools/scripts/verify-security-headers.cjs` | **Thêm mới** — script QA kiểm header trên bản build thật không cần DB (thuộc phạm vi `tools/scripts/**` của tester) |

Không đụng: `client/**`, routes/controllers/models/lib, `package.json`, CI/CD, `.env*` — đúng ràng buộc.

## 4. Hạn chế & ghi chú

1. **Smoke UI Playwright + test trên DB thật chưa chạy:** máy QA không có PostgreSQL local (`ECONNREFUSED`) và boot production bị guard fail-fast chặn đúng hành vi vì `DATABASE_URL` thiếu TLS — đây là **bằng chứng guard bảo mật hoạt động đúng**, không phải bug. Đã bù bằng script verify memory-model serve đúng `client/dist` build thật (AC7). Nếu chủ repo muốn smoke UI đầy đủ, chạy `npm run smoke` trên môi trường có DB dev.
2. `react-router-dom` 6.x (client) dính 2 CVE moderate — **chờ chủ repo duyệt** upgrade 7.18.4 (breaking change, task FE riêng). Xem task doc §4 "Ngoài phạm vi".
3. HSTS `preload` — chờ quyết định đăng ký domain của chủ repo.
4. fe-coder bỏ qua (task thuần BE) — đúng quy trình rút gọn.

## 5. Handoff

```text
[HANDOFF] tester -> chu-repo
Task: docs/tasks/2026-09-25-tang-cuong-bao-mat-chieu-sau.md · Status: DONE
Artifacts: docs/qa/2026-09-25-tang-cuong-bao-mat-chieu-sau.md (file này), tools/scripts/verify-security-headers.cjs
Verify: npm run verify → 65/65 pass + build EXIT=0 · verify-security-headers.cjs → HOME/IMG/API=200
Next: chủ repo quyết định (1) upgrade react-router-dom 7.18.4 — task FE riêng; (2) HSTS preload + đăng ký domain
```
