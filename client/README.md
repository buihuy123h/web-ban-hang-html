# 🍽️ Đồ Inox Gia Đình – Storefront (FE / BE tách riêng)

Storefront hiện đại cho đồ gia dụng inox (nồi, chảo, bát đĩa, dụng cụ bếp), **tách riêng Frontend và Backend**:

- **`client/`** — Frontend: **React + Vite + React Router**, giỏ hàng đầy đủ, gọi REST API của backend.
- **`server/`** — Backend: **Express REST API** (danh mục, sản phẩm, đơn hàng) + serve bản build client ở production.

Ngôn ngữ thiết kế: **Editorial Circular Commerce — Earth Edition** — nền kem ấm, hairline, olive làm màu tương tác, thẻ trắng tonal, ảnh catalogue.

## 🗂️ Cấu trúc

```
├── .github/workflows/ci.yml       # CI: test backend + build frontend (GitHub Actions)
├── .gitignore
├── client/                        # FRONTEND (React + Vite)
│   ├── package.json
│   ├── vite.config.js             # Proxy /api → http://localhost:3000 khi dev
│   ├── index.html
│   ├── docs/                      # Tài liệu thiết kế (DESIGN, PRODUCT, figma, audit UI, thiết kế gốc stitch)
│   └── src/
│       ├── api/                   # Lớp gọi REST API
│       │   ├── client.js          #   fetch wrapper + xử lý lỗi (ApiError)
│       │   ├── catalog.js         #   categories, products, product/:id
│       │   └── orders.js          #   POST /api/orders (đặt hàng)
│       ├── context/
│       │   ├── CatalogContext.jsx # Lấy sản phẩm từ API 1 lần, chia sẻ toàn app
│       │   └── CartContext.jsx    # Giỏ hàng + đã lưu, localStorage, toast
│       ├── data/productImages.js  # Ảnh danh mục (asset của FE)
│       ├── components/            # NavBar, Footer, ProductCard, Toast, ScrollToTop
│       ├── pages/                 # Home, Products, ProductDetail, Cart, Saved, About, Contact, NotFound
│       └── main.jsx / App.jsx / *.css
└── server/                        # BACKEND (Express API)
    ├── package.json
    ├── server.js                  # REST API + serve client/dist (production)
    ├── scripts/deploy.ps1         # Deploy 1 lệnh: test → build → restart → health check
    ├── test/api.test.js           # 16 test API (node:test có sẵn của Node, 0 dependency)
    └── data/
        ├── products.json          # 12 sản phẩm + 4 danh mục (nguồn dữ liệu duy nhất)
        └── orders.json            # Đơn hàng (dữ liệu runtime, không commit)
```

## 🔌 REST API

| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/api/health` | Kiểm tra server còn sống |
| GET | `/api/categories` | Danh sách danh mục |
| GET | `/api/products?cat=&q=&sort=` | Danh sách sản phẩm (lọc, tìm, sắp xếp) |
| GET | `/api/products/:id` | Chi tiết sản phẩm + sản phẩm liên quan |
| POST | `/api/orders` | Tạo đơn hàng — backend tự kiểm tra dữ liệu và **tính lại tiền theo giá server** (không tin giá client), lưu vào `server/data/orders.json` |

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

> Tài liệu thiết kế (DESIGN.md, PRODUCT.md, figma, audit UI, thiết kế gốc stitch) nằm tại `client/docs/`.

## 🔄 CI/CD

**CI — GitHub Actions (`.github/workflows/ci.yml`):** mỗi push / pull request chạy 2 job song song:
- `backend` — `npm ci` + `npm test` (16 test API viết bằng `node:test` có sẵn của Node, không cần cài gì thêm)
- `frontend` — `npm ci` + `npm run build`, bản build được lưu thành artifact `client-dist`

**Test backend tại máy:**

```bash
cd server
npm test   # health, danh mục, lọc/tìm/sắp xếp, đặt hàng, validate, security headers, gzip…
```

**CD — deploy tại máy chỉ với 1 lệnh:**

```bash
cd server
npm run deploy   # = scripts/deploy.ps1: test backend → build frontend → restart server → health check
```

Script tự dừng tiến trình cũ đang chiếm port 3000, khởi động lại `node server.js` ở chế độ nền, và chỉ báo thành công sau khi `/api/health` trả `ok`. Thêm `-SkipTests` nếu muốn bỏ qua bước test.

**Bảo mật & hiệu năng tích hợp trong server (không thêm dependency):** security headers (`nosniff`, chặn iframe, Referrer-Policy, Permissions-Policy), rate limit 240 req/phút/IP cho `/api` (429 + `Retry-After`), gzip tự động cho JSON lớn, cache `immutable` cho `/assets` (file Vite có hash) và `no-cache` cho HTML, request log, graceful shutdown (SIGINT/SIGTERM), tự tạo `data/orders.json` nếu thiếu.

## ✨ Tính năng

- **Trang chủ**: hero split với **search console**, photo card kèm seal kiểm định, trust strip, danh mục tile ảnh, tiêu chuẩn 01/02/03, banner khuyến mãi kèm nút sao chép mã INOX10
- **Danh sách sản phẩm**: dữ liệu từ API, tìm kiếm realtime, lọc 5 danh mục, sắp xếp, trạng thái lọc đồng bộ lên URL (`?cat=`, `?q=`, `?sort=`)
- **Chi tiết sản phẩm**: gallery nhiều góc, giá khuyến mãi & % giảm, thông số, sản phẩm liên quan, breadcrumb
- **Giỏ hàng**: thêm/tăng giảm/xóa, mã INOX10, chọn vận chuyển & thanh toán, validate form, **đặt hàng gọi thẳng `POST /api/orders`** — backend tính tổng tiền chuẩn và lưu đơn, freeship đơn từ 500K, lưu localStorage
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
| Font | Plus Jakarta Sans (display) + Be Vietnam Pro (body) + mono hệ thống | Toàn site, hỗ trợ tiếng Việt |

Bảng màu kế thừa palette **"Earth" trending trên Coolors** (`#606C38` · `#283618` · `#FEFAE0` · `#DDA15E` · `#BC6C25`), tinh chỉnh đậm hơn để đạt tương phản WCAG AA.
