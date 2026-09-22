# 🔧 tools/ — Bộ kiểm thử UI (Playwright)

Các script kiểm tra giao diện & backend **chạy thật trên trình duyệt** (Playwright). Không thuộc FE/BE — chỉ dùng khi phát triển/QA, không chạy trong CI thường (trừ job smoke chạy thủ công).

```
tools/
├── scripts/     ← mã nguồn các script kiểm thử
├── artifacts/   ← ảnh chụp / file dump khi chạy (gitignored — script tự tạo lại)
└── package.json ← npm scripts + dependency playwright
```

## 🚀 Chạy

```bash
# 1. Server phải đang chạy (build production hoặc dev):
cd server && npm run dev          # hoặc: npm start (sau khi đã build client)

# 2. Chạy tool từ thư mục tools/ (lần đầu: npm install):
cd tools
npm run smoke          # Smoke test toàn UI: mở từng trang, bấm mọi nút, bắt lỗi console — exit 1 nếu FAIL
npm run shoot          # Chụp full-page mọi trang chính → artifacts/cur-*.png
npm run check:spa      # SPA fallback cho deep-link + header cache của chunk lazy
npm run check:trust    # Dải 3 cam kết dưới hero (desktop + mobile)
npm run check:visual   # Google Maps iframe + ảnh thẻ sản phẩm
npm run check:perf     # Đo byte truyền: brotli/gzip, ETag/304, cache header
npm run verify:changes # Kiểm chứng các thay đổi gần nhất (hero, /saved, /about)
npm run verify:fab     # Bộ nút liên hệ nổi (ContactFab) desktop + mobile
npm run probe:reveal   # Hiệu ứng scroll-reveal (.reveal, animation-timeline)
npm run debug:style    # Debug nhanh style thẻ sản phẩm
npm run scan:fb        # Quét fanpage Facebook (không cần đăng nhập)
```

Hoặc gọi từ **gốc repo** (không cần `cd tools`):

```bash
npm run smoke    # root package.json chuyển tiếp vào tools/
```

## 📁 Quy ước

- Mọi ảnh chụp / file dump ghi vào `tools/artifacts/` (đã gitignore) — không làm bẩn repo, xem bằng trình xem ảnh rồi xóa thoải mái.
- `BASE=http://localhost:5173 npm run smoke` — trỏ sang FE dev server thay vì production :3000.
- Script smoke/shoot/trust **exit code ≠ 0 khi phát hiện lỗi** → cắm được vào CI (xem job `smoke` trong `.github/workflows/ci.yml`, chạy bằng `workflow_dispatch`).
