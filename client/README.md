# 🛒 Đồ Cũ Quang Huy – Storefront (FE / BE tách riêng)

Storefront hiện đại cho đồ cũ thanh lý (ghế nhựa, kệ inox, giường tầng, nồi chảo, đồ dùng quán ăn), **tách riêng Frontend và Backend**:

- **`client/`** — Frontend: **React + Vite + React Router**, giỏ hàng đầy đủ, gọi REST API của backend.
- **`server/`** — Backend: **Express REST API** (danh mục, sản phẩm, đơn hàng) + serve bản build client ở production.

Ngôn ngữ thiết kế: **Editorial Circular Commerce — Earth Edition** — nền kem ấm, hairline, olive làm màu tương tác, thẻ trắng tonal, ảnh catalogue.

## 🗂️ Cấu trúc

```
├── package.json                   # 🎛 Orchestrator gốc: build/test/verify/deploy cả FE + BE
├── .github/workflows/
│   ├── ci.yml                     # CI: test BE + build FE (+ smoke Playwright chạy thủ công)
│   └── deploy.yml                 # CD: push tag v* → đóng gói release deploy-ready
├── .gitignore
├── client/                        # FRONTEND (React + Vite)
│   ├── package.json
│   ├── vite.config.js             # Proxy /api → :3000 khi dev + tách vendor chunk khi build
│   ├── index.html
│   ├── docs/                      # Tài liệu thiết kế (DESIGN, PRODUCT, figma)
│   └── src/
│       ├── api/                   # Lớp gọi REST API (client.js, catalog.js, orders.js)
│       ├── context/               # CatalogContext (dữ liệu) + CartContext (giỏ hàng, đã lưu)
│       ├── data/productImages.js  # Bản đồ ảnh danh mục (ảnh phục vụ từ BE /images)
│       ├── components/            # NavBar, Footer, ProductCard, ContactFab, Toast, ScrollToTop
│       ├── pages/                 # Home, Products, ProductDetail, Cart, Saved, About, Contact, NotFound
│       └── main.jsx / App.jsx / *.css
├── server/                        # BACKEND (Express API — cấu trúc MVC)
│   ├── package.json
│   ├── index.js                   # Entry: nạp .env → SQL Server → listen :3000 → graceful shutdown
│   ├── app.js                     # Lắp đặt app (middleware + routes + error handler)
│   ├── routes/ controllers/ models/ middleware/   # MVC chuẩn
│   ├── lib/                       # db.js (pool SQL Server) + chat.js (chatbot AI RAG)
│   ├── scripts/                   # deploy.ps1, free-port.ps1, precompress.js, optimize-images.ps1
│   ├── test/                      # 39 test API (5 bộ — node:test, 0 dependency)
│   ├── data/                      # products.json (fixture test/seed) + chat-knowledge.json
│   ├── database/                  # SQL + seed + migration dữ liệu
│   ├── docs/                      # DATABASE.md + CHATBOT.md
│   └── public/images/             # Ảnh thật: catalog/ + products/ (serve tại /images, cache 30 ngày)
└── tools/                         # Kiểm thử UI Playwright (xem tools/README.md)
    ├── scripts/                   # Mã nguồn các script kiểm thử
    └── artifacts/                 # Ảnh chụp khi chạy (gitignored)
```

## 🔌 REST API

| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/api/health` | Kiểm tra server còn sống |
| GET | `/api/categories` | Danh sách danh mục |
| GET | `/api/products?cat=&q=&sort=` | Danh sách sản phẩm (lọc, tìm, sắp xếp) |
| GET | `/api/products/:id` | Chi tiết sản phẩm + sản phẩm liên quan |
| POST | `/api/orders` | Tạo đơn hàng — backend tự kiểm tra dữ liệu và **tính lại tiền theo giá server** (không tin giá client), ghi đơn vào SQL Server bằng stored procedure |
| POST | `/api/chat` | Trợ lý khách hàng AI (RAG trên dữ liệu shop: sản phẩm, phí ship, địa chỉ; fallback thân thiện khi thiếu API key) |

## 🚀 Chạy dự án

Client và server **độc lập** — mỗi thư mục tự cài và tự chạy:

```bash
# 1. Cài dependencies (mỗi thư mục một lần)
cd client
npm install
cd ../server
npm install

# 2. Mở 2 terminal chạy song song:
#    Terminal 1 — Backend (http://localhost:3000):
cd server
npm run dev

#    Terminal 2 — Frontend (http://localhost:5173, proxy /api về 3000):
cd client
npm run dev

# 3. Build production (trong client/)
cd client
npm run build

# 4. Chạy production server — API + serve client build tại http://localhost:3000
cd server
npm start
```

> Tài liệu thiết kế (DESIGN.md, PRODUCT.md, figma) nằm tại `client/docs/`.

## 🔄 CI/CD

**CI — GitHub Actions (`.github/workflows/ci.yml`):** mỗi push (main) / pull request chạy 2 job song song:
- `backend` — `npm ci` + `npm test` (39 test API — 5 bộ, viết bằng `node:test` có sẵn của Node, không cần cài gì thêm)
- `frontend` — `npm ci` + `npm run build` + **precompress Brotli/Gzip** → artifact `client-dist` **deploy-ready** (lấy về là chạy được, không cần nén thêm trên server)
- `smoke` — smoke test UI thật bằng Playwright (chỉ chạy khi bấm *Run workflow* — không làm chậm CI thường)
- Tối ưu: `concurrency` hủy run cũ khi push liên tiếp, `permissions: contents: read`, cache npm theo lockfile từng package.

**CD — GitHub Actions (`.github/workflows/deploy.yml`):** push tag `v*` (hoặc *Run workflow*) → test → build → đóng gói `.tar.gz` gồm `server/` + `client-dist/` (đã nén sẵn) thành artifact. Tải về, copy lên máy chủ:

```bash
tar -xzf do-cu-quang-huy-v*.tar.gz -C /opt/shop && cd /opt/shop/server
npm ci --omit=dev && npm start        # API + client build tại :3000
```

**Test backend tại máy:**

```bash
npm test          # từ gốc repo — hoặc: cd server && npm test
```

**Deploy tại máy chỉ với 1 lệnh (Windows):**

```bash
npm run deploy    # từ gốc repo — = scripts/deploy.ps1: test → build → precompress → restart → health check
```

Script tự dừng tiến trình cũ đang chiếm port 3000, khởi động lại `node index.js` ở chế độ nền, và chỉ báo thành công sau khi `/api/health` trả `ok`. Thêm `-SkipTests` nếu muốn bỏ qua bước test.

**Bảo mật & hiệu năng tích hợp trong server (không thêm dependency):** security headers (CSP strict, `nosniff`, chặn iframe, COOP, Referrer-Policy, Permissions-Policy, HSTS sau proxy HTTPS, ẩn `X-Powered-By`), CORS chặt (production chỉ cùng origin; mở qua `CORS_ORIGIN`), `X-Request-Id` gắn mọi response + log truy vết, rate limit 240 req/phút/IP cho `/api` + riêng đặt hàng 10/phút và chat theo `CHAT_RATE_MAX` (429 + `Retry-After`), Brotli/Gzip tự động cho JSON lớn, giới hạn body 100KB (413), cache `immutable` cho `/assets` (file Vite có hash) và `no-cache` cho HTML, graceful shutdown (SIGINT/SIGTERM + fatal handler thoát sạch để process manager khởi động lại).

## ✨ Tính năng

- **Trang chủ**: hero split với **search console**, photo card kèm seal kiểm tra, trust strip, danh mục tile ảnh (6 nhóm), tiêu chuẩn 01/02/03, banner khuyến mãi kèm nút sao chép mã QUANGHUY10
- **Danh sách sản phẩm**: dữ liệu từ API, tìm kiếm realtime, lọc 6 danh mục, sắp xếp, trạng thái lọc đồng bộ lên URL (`?cat=`, `?q=`, `?sort=`)
- **Chi tiết sản phẩm**: gallery nhiều góc, giá khuyến mãi & % giảm, thông số, sản phẩm liên quan, breadcrumb
- **Giỏ hàng**: thêm/tăng giảm/xóa, mã QUANGHUY10, chọn vận chuyển & thanh toán, validate form, **đặt hàng gọi thẳng `POST /api/orders`** — backend tính tổng tiền chuẩn và lưu đơn, freeship đơn từ 500K, lưu localStorage
- **Liên hệ**: form có validate + **Google Maps nhúng** (không cần API key) + nút chỉ đường
- **Đã lưu**: lưu sản phẩm xem sau, badge navbar
- **Khác**: trang 404, toast, back-to-top, reveal-on-scroll, `prefers-reduced-motion`, responsive đầy đủ

## 🎨 Design system

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--canvas` | `#f7f4e9` | Nền trang (kem đá ấm) |
| `--surface` | `#fffdf6` | Bề mặt thẻ, form |
| `--surface-low` / `--surface-high` | `#efe9d8` / `#e9e2cc` | Dải tonal, field form, icon circle |
| `--ink` | `#283618` | Chữ chính (olive đậm) |
| `--muted` | `#5f6553` | Chữ phụ |
| `--primary` | `#606c38` | Giá, link, icon, focus, nút chốt đơn (olive) |
| `--inverse` | `#222c16` | CTA graphite-olive, banner tối, footer |
| `--accent` | `#a8581c` | Khuyến mãi, giảm giá (đất nung) |
| `--success` | `#356138` | Trạng thái tốt |
| `--line` | `#e4decb` | Hairline, viền |
| Font | Quicksand (display) + Nunito (body) + mono hệ thống | Toàn site, hỗ trợ tiếng Việt |

Bảng màu kế thừa palette **"Earth" trending trên Coolors** (`#606C38` · `#283618` · `#FEFAE0` · `#DDA15E` · `#BC6C25`), tinh chỉnh đậm hơn để đạt tương phản WCAG AA.
