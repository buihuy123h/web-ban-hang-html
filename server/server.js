/**
 * BACKEND — Express REST API
 * - API danh mục / sản phẩm / đơn hàng cho client (React + Vite).
 * - Production: serve bản build client (client/dist) + SPA fallback.
 * - Bảo mật & hiệu năng: security headers, rate limit, gzip + ETag/304 cho JSON,
 *   nén sẵn (precompress) Brotli/Gzip + cache RAM cho file tĩnh, cache headers,
 *   ghi đơn bất đồng bộ nguyên tử, request log, graceful shutdown —
 *   không cần thêm dependency ngoài Express.
 */
'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { precompress } = require('./scripts/precompress');

const app = express();
// Chạy sau reverse proxy (Nginx/Cloudflare…) thì đặt TRUST_PROXY (vd: 1 hoặc "loopback")
// để req.ip lấy đúng IP client từ X-Forwarded-For → rate limit không gộp nhầm mọi khách vào 1 IP.
if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY);
const CLIENT_DIST = path.resolve(__dirname, '..', 'client', 'dist');
const IS_TEST = process.env.NODE_ENV === 'test' || process.env.npm_lifecycle_event === 'test';
const PKG = require('./package.json');

/* ===== Dữ liệu ===== */
const DATA_DIR = path.join(__dirname, 'data');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
// Ảnh thật (danh mục + sản phẩm) phục vụ tại /images/* — DB chỉ lưu đường dẫn tương đối.
const IMAGES_DIR = path.join(__dirname, 'public', 'images');

// Tự tạo dữ liệu rỗng nếu thiếu (máy CI, bản sao mới).
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, '[]');
if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });

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

/* ===== Ảnh: chuẩn hoá trường image/images + kiểm tra file khi khởi động =====
 * Nguyên tắc chống lỗi ảnh sau khi lên mạng (chi tiết: server/docs/DATABASE.md):
 *  1) DB chỉ lưu ĐƯỜNG DẪN TƯƠNG ĐỐI "/images/..." — không lưu URL có domain, nên đổi
 *     tên miền hay deploy sang máy khác ảnh vẫn chạy, không phải sửa dữ liệu.
 *  2) File ảnh nằm trong server/public/images (catalog/ = danh mục & hero,
 *     products/ = ảnh riêng từng món) → khi deploy copy kèm thư mục này.
 *  3) Thiếu file server chỉ CẢNH BÁO (không chết) — FE tự fallback về ảnh danh mục.
 */
const imageFileFor = (ref) => {
  if (typeof ref !== 'string' || !ref.startsWith('/images/')) return null;
  const target = path.resolve(IMAGES_DIR, `.${ref.slice('/images'.length)}`);
  return target.startsWith(IMAGES_DIR + path.sep) ? target : null;
};

const imageProblems = [];
const checkImageRef = (label, ref) => {
  const file = imageFileFor(ref);
  if (!file) {
    imageProblems.push(`${label}: đường dẫn "${ref}" phải có dạng "/images/..."`);
    return;
  }
  if (!fs.existsSync(file)) imageProblems.push(`${label}: không tìm thấy file ${ref}`);
};

for (const product of products) {
  // Dữ liệu cũ chưa có trường ảnh → tự điền rỗng để API luôn trả đủ image/images.
  if (!product.image) product.image = null;
  if (!Array.isArray(product.images)) product.images = [];
  const refs = [...(product.image ? [product.image] : []), ...product.images];
  refs.forEach((ref, index) => checkImageRef(`Sản phẩm #${product.id} "${product.name}"${index ? ` (ảnh phụ ${index})` : ''}`, ref));
}
for (const category of categories) {
  if (category.image) checkImageRef(`Danh mục ${category.key}`, category.image);
}
if (imageProblems.length && !IS_TEST) {
  console.warn(`[images] ${imageProblems.length} ảnh khai báo trong data/products.json thiếu file:`);
  for (const line of imageProblems) console.warn(`  - ${line}`);
  console.warn('  → FE sẽ tự fallback về ảnh danh mục. Chép file ảnh vào server/public/images/ rồi restart.');
}

// Chỉ mục O(1) theo id — tra cứu chi tiết sản phẩm / ghép đơn không phải quét mảng mỗi lần.
const productById = new Map(products.map((p) => [Number(p.id), p]));

/* ===== Lưu đơn hàng: cache RAM + ghi bất đồng bộ nguyên tử (tmp → rename) =====
 * - Đọc file 1 lần, sau đó mọi thao tác đều trên RAM → POST /api/orders không bị chặn I/O.
 * - Ghi qua file tạm rồi rename: nếu tiến trình chết giữa chừng, orders.json không bao giờ
 *   bị ghi dở (trước đây writeFileSync trực tiếp có thể để lại JSON hỏng).
 * - Nhiều đơn về gần như đồng thời → gộp thành 1 lần ghi (dirty flag), không đè nhau.
 */
let ordersCache = null;
let ordersCodeSet = null;
let writingOrders = false;
let ordersDirty = false;

const loadOrders = () => {
  if (!ordersCache) {
    ordersCache = readJson(ORDERS_FILE, []);
    if (!Array.isArray(ordersCache)) ordersCache = [];
    ordersCodeSet = new Set(ordersCache.map((o) => o && o.code).filter(Boolean));
  }
  return ordersCache;
};

const persistOrders = () => {
  if (writingOrders) {
    ordersDirty = true; // Đang ghi dở → ghi nốt lần nữa sau khi xong.
    return;
  }
  writingOrders = true;
  ordersDirty = false;
  const snapshot = JSON.stringify(ordersCache, null, 2);
  const tmpFile = `${ORDERS_FILE}.tmp`;
  fs.writeFile(tmpFile, snapshot, (err) => {
    if (err) {
      writingOrders = false;
      console.error('[orders] Không ghi được file tạm — đơn vẫn trả về client, chỉ mất lưu bền:', err.message);
      return;
    }
    fs.rename(tmpFile, ORDERS_FILE, (renameErr) => {
      writingOrders = false;
      if (renameErr) {
        console.error('[orders] Không thay được file đơn hàng:', renameErr.message);
        return;
      }
      if (ordersDirty) persistOrders();
    });
  });
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

/* ===== Gzip + ETag/304 cho phản hồi JSON của API =====
 * - Body ≥ 1KB: nén gzip (cache kết quả theo nội dung → request sau không phải nén lại).
 * - Gắn ETag theo nội dung; client gửi If-None-Match khớp → 304 không thân thể
 *   (tiết kiệm cả băng thông lẫn CPU nén). Body nhỏ hơn 1KB: express tự lo ETag/304.
 */
const gzipCache = new Map(); // key: JSON gốc → { packed, etag } (giới hạn số mục bên dưới)
const GZIP_CACHE_MAX = 64;

const makeEtag = (body) => `"${body.length.toString(16)}-${crypto.createHash('sha1').update(body).digest('hex').slice(0, 16)}"`;

app.use((req, res, next) => {
  if (!String(req.headers['accept-encoding'] || '').includes('gzip')) return next();
  const originalJson = res.json.bind(res);
  res.json = (payload) => {
    const body = Buffer.from(JSON.stringify(payload));
    if (body.length < 1024) return originalJson(payload);

    const etag = makeEtag(body);
    res.setHeader('ETag', etag);
    const ifNoneMatch = req.headers['if-none-match'];
    if (ifNoneMatch && ifNoneMatch.split(',').some((tag) => tag.trim() === etag)) {
      return res.status(304).end();
    }

    let entry = gzipCache.get(etag); // Key theo ETag (hash nội dung) — key theo Buffer sẽ so tham chiếu → cache không bao giờ trúng.
    if (!entry) {
      entry = { packed: zlib.gzipSync(body) };
      if (gzipCache.size >= GZIP_CACHE_MAX) gzipCache.delete(gzipCache.keys().next().value);
      gzipCache.set(etag, entry);
    }
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Vary', 'Accept-Encoding');
    return res.end(entry.packed);
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
  const product = productById.get(Number(req.params.id));
  if (!product) {
    return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
  }
  const related = products
    .filter((item) => item.category === product.category && item.id !== product.id)
    .slice(0, 4);
  // Nội dung chỉ thay đổi khi thay products.json → cho trình duyệt cache 60s.
  res.set('Cache-Control', 'public, max-age=60');
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
    const product = productById.get(id);
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

  const orders = loadOrders();

  // Sinh mã duy nhất (đối chiếu cả các đơn cũ) — tránh trùng khi 2 đơn cùng giây.
  let code;
  do {
    code = `DI${String(Date.now()).slice(-6)}${String(Math.floor(Math.random() * 90) + 10)}`;
  } while (ordersCodeSet.has(code));
  ordersCodeSet.add(code);

  const order = {
    // DI + 8 chữ số: 6 số cuối timestamp + 2 số ngẫu nhiên.
    code,
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

  orders.push(order);
  persistOrders();

  return res.status(201).json({ order });
});

/* ===== API không tồn tại → trả JSON thay vì HTML ===== */
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Không tìm thấy API route.' });
});

/* ===== Ảnh DB (/images/*): file tĩnh, cache 30 ngày immutable =====
 * Tên file ảnh không đổi (thay ảnh = thêm file mới + sửa đường dẫn trong DB) nên cache
 * dài là an toàn: trình duyệt không tải lại ảnh đã xem → tiết kiệm băng thông, tải nhanh.
 */
app.use('/images', express.static(IMAGES_DIR, {
  maxAge: '30d',
  immutable: true,
  dotfiles: 'ignore',
}));

/* ===== Production: serve client build + SPA fallback ===== */
if (fs.existsSync(CLIENT_DIST)) {
  /* --- 1) File văn bản đã nén sẵn (.br/.gz) + cache RAM ---
   * Bundle JS/CSS của Vite đi trên mạng nhỏ hơn 3-4 lần; phục vụ từ bộ nhớ nên
   * không đụng đĩa sau lần đọc đầu → phản hồi nhanh và ổn cả khi nhiều người truy cập. */
  const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8',
    '.webmanifest': 'application/manifest+json',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ico': 'image/x-icon',
  };
  const STATIC_CACHE_MAX = 100;
  const staticCache = new Map(); // key: đường dẫn file nén → { buffer, mtimeMs }

  const readCached = (file) => {
    const mtime = fs.statSync(file).mtimeMs;
    let entry = staticCache.get(file);
    if (!entry || entry.mtimeMs !== mtime) {
      entry = { buffer: fs.readFileSync(file), mtimeMs: mtime };
      if (staticCache.size >= STATIC_CACHE_MAX) staticCache.delete(staticCache.keys().next().value);
      staticCache.set(file, entry);
    }
    return entry.buffer;
  };

  const cacheControlFor = (filePath) => {
    // Vite đặt hash vào tên file trong /assets → cache 1 năm là an toàn.
    if (/[\\/]assets[\\/]/.test(filePath)) return 'public, max-age=31536000, immutable';
    if (filePath.endsWith('.html')) return 'no-cache';
    return undefined;
  };

  const acceptsEncoding = (req, name) =>
    new RegExp(`(?:^|,)\\s*${name}\\s*(?:;|,|$)`, 'i').test(String(req.headers['accept-encoding'] || ''));

  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch {
      return next();
    }
    const filePath = path.normalize(path.join(CLIENT_DIST, pathname));
    // Chặn path traversal: đường dẫn phải nằm trong client/dist.
    if (filePath !== CLIENT_DIST && !filePath.startsWith(CLIENT_DIST + path.sep)) return next();
    const ext = path.extname(filePath).toLowerCase();
    if (!MIME[ext]) return next(); // Ảnh & loại lạ → express.static lo (stream từ đĩa).

    let stat;
    try {
      stat = fs.statSync(filePath);
    } catch {
      return next();
    }
    if (!stat.isFile()) return next();

    // Ưu tiên Brotli (gọn hơn gzip ~15-20%), lùi về gzip, rồi mới tới bản gốc.
    let encoding = null;
    let serveFile = filePath;
    if (acceptsEncoding(req, 'br') && fs.existsSync(`${filePath}.br`)) {
      encoding = 'br';
      serveFile = `${filePath}.br`;
    } else if (acceptsEncoding(req, 'gzip') && fs.existsSync(`${filePath}.gz`)) {
      encoding = 'gzip';
      serveFile = `${filePath}.gz`;
    }

    let body;
    try {
      body = readCached(serveFile);
    } catch {
      return next(); // Đọc hỏng thì trả thẳng qua express.static cho lành.
    }

    const cacheControl = cacheControlFor(filePath);
    const etag = `"${stat.size.toString(16)}-${Math.round(stat.mtimeMs).toString(16)}${encoding ? `-${encoding}` : ''}"`;
    res.setHeader('Content-Type', MIME[ext]);
    res.setHeader('ETag', etag);
    if (cacheControl) res.setHeader('Cache-Control', cacheControl);
    res.setHeader('Vary', 'Accept-Encoding');
    if (encoding) res.setHeader('Content-Encoding', encoding);
    if ((req.headers['if-none-match'] || '').split(',').some((tag) => tag.trim() === etag)) {
      return res.status(304).end();
    }
    res.setHeader('Content-Length', String(body.length));
    if (req.method === 'HEAD') return res.end();
    return res.end(body);
  });

  // Lần đầu chạy thật (không phải test): tự nén sẵn nếu client build chưa có bản .br/.gz.
  if (!IS_TEST && require.main === module) {
    const hasAnyBr = (function find(dir) {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (find(full)) return true;
        } else if (e.name.endsWith('.br')) {
          return true;
        }
      }
      return false;
    })(CLIENT_DIST);
    if (!hasAnyBr) {
      const r = precompress(CLIENT_DIST);
      console.log(`[precompress] Đã nén sẵn ${r.created} bản (Brotli + Gzip) cho client build.`);
    }
  }

  /* --- 2) Phần còn lại (ảnh, video…): express.static giữ nguyên --- */
  app.use(express.static(CLIENT_DIST, {
    index: 'index.html',
    setHeaders(res, filePath) {
      const cacheControl = cacheControlFor(filePath);
      if (cacheControl) res.setHeader('Cache-Control', cacheControl);
    },
  }));
  app.get('*', (req, res) => {
    // /images, /assets thiếu file → 404 thật. Trả index.html sẽ khiến <img> decode HTML
    // (ảnh lỗi âm thầm, rất khó debug khi deploy).
    if (req.path.startsWith('/images/') || req.path.startsWith('/assets/')) {
      return res.status(404).end('Not found');
    }
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
    console.log(`  - Ảnh: ${IMAGES_DIR} (phục vụ tại /images, cache 30 ngày)`);
    console.log(hasClient
      ? `  - Client build: đang serve từ ${CLIENT_DIST}`
      : '  - Client build: chưa có (chạy "npm run build" ở client để serve kèm).');
  });
  // Keep-alive dài hơn mặc định 5s → trình duyệt tái dùng kết nối, ít bắt tay TCP lại.
  // Nên nhỏ hơn idle timeout của proxy phía trước (Nginx/Cloudflare thường 60-75s).
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000; // Phải lớn hơn keepAliveTimeout.
  server.requestTimeout = 30_000; // Cắt request gửi quá chậm (slowloris), nhả socket sớm.
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



