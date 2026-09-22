# 🛒 Đồ Cũ Quang Huy — Dự án tách riêng FE / BE

Dự án **tách riêng Frontend và Backend** thành 2 thư mục độc lập, mỗi phần tự cài đặt, tự chạy, giao tiếp với nhau qua REST API (`/api/*`). Gốc repo có **`package.json` điều phối** — 1 lệnh duy nhất cho build / test / deploy cả FE + BE, dùng thống nhất cho máy-local lẫn CI/CD.

```
web ban hang html/
│
├── package.json            ← 🎛 Orchestrator: npm run build / test / verify / deploy từ gốc repo
├── .github/workflows/      ← 🤖 ci.yml (CI) + deploy.yml (CD — đóng gói release)
├── client/                 ← 🎨 FRONTEND (React + Vite) — chi tiết: client/README.md
├── server/                 ← ⚙️ BACKEND (Express API + ảnh + database) — chi tiết: server/docs/
└── tools/                  ← 🔧 Kiểm thử UI bằng Playwright — chi tiết: tools/README.md
    ├── scripts/            ←    mã nguồn các script kiểm thử
    └── artifacts/          ←    ảnh chụp khi chạy (gitignored, tự tạo lại)
```

## 🎛 Lệnh điều phối từ gốc repo

```bash
npm run setup    # Cài dependencies cho client + server + tools (1 lần)
npm test         # 21 test API của backend
npm run build    # Build client production + nén sẵn Brotli/Gzip
npm run verify   # test + build — bước "gate" trước khi release/deploy
npm start        # Server production: API + client build tại http://localhost:3000
npm run deploy   # Deploy cục bộ: test → build → precompress → restart → health check
npm run smoke    # Smoke test UI bằng Playwright (cần server đang chạy)
```

## 🎨 FRONTEND — thư mục `client/`

React + Vite + React Router. Chạy tại `http://localhost:5173`, mọi request `/api/*` được proxy về backend cổng 3000.

| File / thư mục | Vai trò |
|---|---|
| `client/package.json` | Khai báo dependency FE (react, react-router-dom, vite) |
| `client/vite.config.js` | Cấu hình Vite + proxy `/api`, `/images` → `:3000` + **tách vendor chunk** (cache bền giữa các lần deploy) |
| `client/index.html` | Trang HTML gốc — SEO meta, Open Graph, preload ảnh hero, preconnect fonts |
| `client/src/main.jsx` · `App.jsx` | Điểm vào + định tuyến (lazy-load 7/8 trang) |
| `client/src/api/` | Lớp gọi REST API của backend (`client.js`, `catalog.js`, `orders.js`) |
| `client/src/context/` | State toàn app: giỏ hàng (`CartContext`), dữ liệu sản phẩm (`CatalogContext`) |
| `client/src/components/` | NavBar, Footer, ProductCard, ContactFab, Icon, Toast, ScrollToTop |
| `client/src/pages/` | Home, Products, ProductDetail, Cart, Saved, About, Contact, NotFound |
| `client/src/data/productImages.js` | Bản đồ ảnh danh mục + resolve/fallback ảnh — ảnh phục vụ từ BE (`/images/*`), bundle FE không chứa ảnh |
| `client/docs/` | Tài liệu thiết kế (DESIGN, PRODUCT, figma, audit UI, `design-reference/`) |

```bash
cd client
npm install     # lần đầu
npm run dev     # chạy FE tại http://localhost:5173
npm run build   # build production → client/dist
```

## ⚙️ BACKEND — thư mục `server/`

Express REST API, chạy tại `http://localhost:3000`. Ở production serve luôn bản build FE (`client/dist`) kèm SPA fallback.

| File / thư mục | Vai trò |
|---|---|
| `server/package.json` | Khai báo dependency BE (express) + script test/deploy/precompress |
| `server/server.js` | REST API: `/api/health`, `/api/categories`, `/api/products`, `/api/orders` + security headers, rate limit, gzip + ETag/304, cache RAM, precompress |
| `server/data/products.json` | Nguồn dữ liệu: sản phẩm + danh mục, ảnh lưu **đường dẫn tương đối** `/images/...` |
| `server/public/images/` | File ảnh thật: `catalog/` + `products/` — phục vụ tại `/images` với cache 30 ngày immutable |
| `server/database/` | SQL + script seed dữ liệu |
| `server/scripts/deploy.ps1` | Deploy 1 lệnh: test → build → precompress → restart → health check |
| `server/scripts/precompress.js` | Nén sẵn Brotli/Gzip cho client build (chạy lúc build & server tự chạy khi thiếu) |
| `server/test/api.test.js` | 21 test API (`node:test` có sẵn của Node, 0 dependency) |
| `server/docs/DATABASE.md` | Cách tổ chức database & ảnh sản phẩm để lên mạng không lỗi ảnh |

```bash
cd server
npm install     # lần đầu
npm run dev     # chạy BE tại http://localhost:3000
npm test        # chạy 21 test API
npm run deploy  # test → build FE → precompress → restart server
```

## 🔗 FE và BE giao tiếp thế nào?

- **Khi dev:** FE (5173) gọi `/api/*` → Vite proxy sang BE (3000).
- **Khi production:** chạy `npm run build` (từ gốc repo hoặc `client/`) rồi `npm start` ở `server/` — BE serve bản build FE tại cổng 3000, một server duy nhất.
- Có thể trỏ FE sang BE riêng bằng biến môi trường `VITE_API_URL` (xem `client/src/api/client.js`).

> 📖 Tài liệu chi tiết (REST API, design system, CI/CD, tính năng): xem [`client/README.md`](client/README.md).
>
> 🔧 Quy ước kiểm thử UI (Playwright, artifacts): xem [`tools/README.md`](tools/README.md).
>
> 🖼 **Ảnh khi lên mạng:** DB chỉ lưu đường dẫn tương đối `/images/...`, file ảnh thật nằm ở `server/public/images/` (deploy copy kèm) — hướng dẫn đầy đủ: [`server/docs/DATABASE.md`](server/docs/DATABASE.md).

