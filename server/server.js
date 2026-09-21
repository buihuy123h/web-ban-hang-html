/**
 * BACKEND — Express REST API
 * - API danh mục / sản phẩm / đơn hàng cho client (React + Vite).
 * - Production: serve bản build client (client/dist) + SPA fallback.
 * - Bảo mật & hiệu năng: security headers, rate limit, gzip JSON, cache tĩnh,
 *   request log, graceful shutdown — không cần thêm dependency ngoài Express.
 */
'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const app = express();
const CLIENT_DIST = path.resolve(__dirname, '..', 'client', 'dist');
const IS_TEST = process.env.NODE_ENV === 'test' || process.env.npm_lifecycle_event === 'test';
const PKG = require('./package.json');

/* ===== Dữ liệu ===== */
const DATA_DIR = path.join(__dirname, 'data');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');

// Tự tạo dữ liệu rỗng nếu thiếu (máy CI, bản sao mới).
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, '[]');

const readJson = (file, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
};

const catalog = readJson(PRODUCTS_FILE, { categories: [], products: [] });
const categories = Array.isArray(catalog.categories) ? catalog.categories : [];
const products = Array.isArray(catalog.products) ? catalog.products : [];

const readOrders = () => readJson(ORDERS_FILE, []);
const saveOrders = (orders) => {
  try {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
  } catch {
    /* Không ghi được file — đơn vẫn trả về client, chỉ mất lưu bền. */
  }
};

/* ===== Request log gọn (tắt khi chạy test) ===== */
app.use((req, res, next) => {
  if (!IS_TEST) {
    const startedAt = process.hrtime.bigint();
    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - startedAt) / 1e6;
      console.log(`${req.method} ${req.originalUrl} → ${res.statusCode} (${ms.toFixed(1)}ms)`);
    });
  }
  next();
});

/* ===== Security headers (helmet-lite, không thêm dependency) ===== */
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

app.use(express.json({ limit: '100kb' }));

/* ===== CORS tối thiểu — client chạy origin khác (không qua proxy) vẫn gọi được ===== */
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
});

/* ===== Gzip cho phản hồi JSON của API ===== */
app.use((req, res, next) => {
  if (!String(req.headers['accept-encoding'] || '').includes('gzip')) return next();
  const originalJson = res.json.bind(res);
  res.json = (payload) => {
    const body = Buffer.from(JSON.stringify(payload));
    if (body.length < 1024) return originalJson(payload);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Vary', 'Accept-Encoding');
    return res.end(zlib.gzipSync(body));
  };
  return next();
});

/* ===== Rate limit cho /api (giới hạn mỗi IP, tự dọn bucket hết hạn) ===== */
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = Number(process.env.RATE_LIMIT_MAX) || (IS_TEST ? 100000 : 240);
const rateBuckets = new Map();
const rateSweeper = setInterval(() => {
  const now = Date.now();
  for (const [ip, bucket] of rateBuckets) {
    if (bucket.reset <= now) rateBuckets.delete(ip);
  }
}, RATE_WINDOW_MS);
rateSweeper.unref?.();

app.use('/api', (req, res, next) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  let bucket = rateBuckets.get(ip);
  if (!bucket || bucket.reset <= now) {
    bucket = { count: 0, reset: now + RATE_WINDOW_MS };
    rateBuckets.set(ip, bucket);
  }
  bucket.count += 1;
  res.setHeader('X-RateLimit-Limit', String(RATE_MAX));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, RATE_MAX - bucket.count)));
  if (bucket.count > RATE_MAX) {
    res.setHeader('Retry-After', String(Math.ceil((bucket.reset - now) / 1000)));
    return res.status(429).json({ error: 'Quá nhiều yêu cầu từ máy của bạn. Vui lòng thử lại sau ít phút.' });
  }
  return next();
});

/* ===== API: Sức khoẻ ===== */
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    name: 'inox-store-api',
    version: PKG.version,
    uptime: Math.round(process.uptime()),
    time: new Date().toISOString(),
  });
});

/* ===== API: Danh mục ===== */
app.get('/api/categories', (req, res) => {
  res.set('Cache-Control', 'public, max-age=60');
  res.json(categories);
});

/* ===== API: Danh sách sản phẩm (hỗ trợ ?cat= &q= &sort=) ===== */
app.get('/api/products', (req, res) => {
  const { cat, q, sort } = req.query;
  let list = products.slice();

  if (cat && cat !== 'all') list = list.filter((p) => p.category === cat);
  if (q && String(q).trim()) {
    const needle = String(q).trim().toLowerCase();
    list = list.filter((p) => p.name.toLowerCase().includes(needle));
  }

  switch (sort) {
    case 'price-asc':
      list.sort((a, b) => a.price - b.price);
      break;
    case 'price-desc':
      list.sort((a, b) => b.price - a.price);
      break;
    case 'rating':
      list.sort((a, b) => b.rating - a.rating);
      break;
    default:
      list.sort((a, b) => b.sold - a.sold);
  }

  res.set('Cache-Control', 'public, max-age=30');
  res.json(list);
});

/* ===== API: Chi tiết sản phẩm + sản phẩm liên quan ===== */
app.get('/api/products/:id', (req, res) => {
  const product = products.find((item) => item.id === Number(req.params.id));
  if (!product) {
    return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
  }
  const related = products
    .filter((item) => item.category === product.category && item.id !== product.id)
    .slice(0, 4);
  return res.json({ product, related });
});

/* ===== API: Tạo đơn hàng ===== */
const FREE_SHIP_THRESHOLD = 500000;
const SHIPPING_FEES = { standard: 30000, express: 45000 };
const PROMO_CODES = { QUANGHUY10: 0.1 };
const MAX_ITEMS_PER_ORDER = 50;

const validateOrder = (body) => {
  const fields = {};
  const customer = body.customer && typeof body.customer === 'object' ? body.customer : {};
  const { items } = body;

  if (!Array.isArray(items) || items.length === 0) fields.items = 'Giỏ hàng trống.';
  else if (items.length > MAX_ITEMS_PER_ORDER) fields.items = `Tối đa ${MAX_ITEMS_PER_ORDER} món mỗi đơn.`;
  if (String(customer.name || '').trim().length < 2) fields['customer.name'] = 'Nhập họ tên người nhận.';
  if (!/^0\d{9}$/.test(String(customer.phone || '').trim())) fields['customer.phone'] = 'Số điện thoại cần 10 số và bắt đầu bằng 0.';
  if (String(customer.address || '').trim().length < 10) fields['customer.address'] = 'Nhập địa chỉ giao hàng đầy đủ hơn.';
  if (!SHIPPING_FEES[body.delivery]) fields.delivery = 'Chọn cách giao hàng hợp lệ.';
  if (!['cod', 'transfer'].includes(body.payment)) fields.payment = 'Chọn cách thanh toán hợp lệ.';

  return fields;
};

app.post('/api/orders', (req, res) => {
  const body = req.body || {};
  const fields = validateOrder(body);
  if (Object.keys(fields).length) {
    return res.status(400).json({ error: 'Dữ liệu đơn hàng chưa hợp lệ.', fields });
  }

  // Gộp các dòng trùng sản phẩm. Giá luôn lấy từ dữ liệu server, không tin giá client gửi lên.
  const merged = new Map();
  for (const raw of body.items) {
    const id = Number(raw && raw.id);
    const qty = Math.floor(Number(raw && raw.qty));
    if (!Number.isFinite(qty) || qty < 1 || qty > 99) {
      return res.status(400).json({ error: `Số lượng không hợp lệ (id: ${id}).` });
    }
    merged.set(id, (merged.get(id) || 0) + qty);
  }

  const items = [];
  for (const [id, qty] of merged) {
    const product = products.find((item) => item.id === id);
    if (!product) {
      return res.status(400).json({ error: `Sản phẩm không tồn tại (id: ${id}).` });
    }
    items.push({ id: product.id, name: product.name, price: product.price, qty });
  }

  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const delivery = body.delivery;
  const shippingFee = delivery === 'express' ? SHIPPING_FEES.express : (subtotal >= FREE_SHIP_THRESHOLD ? 0 : SHIPPING_FEES.standard);
  const promoCode = String(body.promoCode || '').trim().toUpperCase();
  const promoRate = PROMO_CODES[promoCode] || 0;
  const discount = promoRate > 0 ? Math.round(subtotal * promoRate) : 0;
  const total = Math.max(0, subtotal + shippingFee - discount);
  const customer = body.customer;

  const order = {
    // DI + 8 chữ số: 6 số cuối timestamp + 2 số ngẫu nhiên → tránh trùng mã khi 2 đơn cùng giây.
    code: `DI${String(Date.now()).slice(-6)}${String(Math.floor(Math.random() * 90) + 10)}`,
    items,
    delivery,
    payment: body.payment,
    promoCode: promoRate > 0 ? promoCode : null,
    subtotal,
    shippingFee,
    discount,
    total,
    customer: {
      name: String(customer.name).trim().slice(0, 80),
      phone: String(customer.phone).trim(),
      address: String(customer.address).trim().slice(0, 300),
      note: String(customer.note || '').trim().slice(0, 500),
    },
    createdAt: new Date().toISOString(),
  };

  const orders = readOrders();
  orders.push(order);
  saveOrders(orders);

  return res.status(201).json({ order });
});

/* ===== API không tồn tại → trả JSON thay vì HTML ===== */
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Không tìm thấy API route.' });
});

/* ===== Production: serve client build + SPA fallback (kèm cache headers) ===== */
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST, {
    index: 'index.html',
    setHeaders(res, filePath) {
      // Vite đặt hash vào tên file trong /assets → cache 1 năm là an toàn.
      if (/[\\/]assets[\\/]/.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  }));
  app.get('*', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
}

/* ===== Báo lỗi tập trung ===== */
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON gửi lên không hợp lệ.' });
  }
  if (!IS_TEST) console.error(`[error] ${req.method} ${req.originalUrl}:`, (err && err.stack) || err);
  if (String(req.originalUrl).startsWith('/api')) {
    return res.status(err && err.status ? err.status : 500).json({ error: 'Lỗi máy chủ. Vui lòng thử lại.' });
  }
  return res.status(500).send('Lỗi máy chủ.');
});

/* ===== Khởi động / xuất cho test & deploy ===== */
let server;
const startServer = (port = process.env.PORT || 3000) => {
  if (server) return server;
  server = app.listen(port, () => {
    const hasClient = fs.existsSync(CLIENT_DIST);
    console.log(`API server đang chạy tại http://localhost:${port}`);
    console.log(`  - API:      http://localhost:${port}/api/health`);
    console.log(`  - Sản phẩm: ${products.length} · Danh mục: ${categories.length}`);
    console.log(hasClient
      ? `  - Client build: đang serve từ ${CLIENT_DIST}`
      : '  - Client build: chưa có (chạy "npm run build" ở client để serve kèm).');
  });
  // Báo lỗi listen thân thiện thay vì stack trace (EADDRINUSE: cổng bị chiếm).
  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      console.error(`[server] Không khởi động được: cổng ${port} đang bị tiến trình khác chiếm (EADDRINUSE).`);
      console.error('         Gợi ý: chạy "npm run dev" (tự giải phóng cổng 3000), hoặc đổi cổng:  $env:PORT=3100; npm run dev');
    } else {
      console.error('[server] Lỗi lắng nghe:', err);
    }
    if (require.main === module) process.exit(1);
  });
  return server;
};

// Chạy trực tiếp (npm start / npm run dev) mới lắng nghe; khi được require để test thì không.
if (require.main === module) {
  startServer();

  const shutdown = (signal) => {
    console.log(`\nNhận ${signal} — đang đóng server…`);
    if (!server) process.exit(0);
    server.close(() => process.exit(0));
    // Chốt sau 3s nếu còn kết nối treo.
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

module.exports = { app, startServer, products, categories };



