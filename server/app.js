'use strict';

/**
 * BACKEND — Express REST API cho client (React + Vite), cấu trúc MVC:
 *   index.js (entry: env + DB + listen)  →  app.js (file này: lắp đặt app)
 *   routes/  → controllers/  →  models/  (SQL Server; memory cho test)
 *   middleware/ (logger, security, CORS, gzip/ETag, rate limit, static client…)
 *   lib/ (db pool, chat AI — thư viện dùng chung, không phải model nghiệp vụ)
 * - Production: serve bản build client (client/dist) + SPA fallback.
 * - Bảo mật & hiệu năng: security headers, rate limit, gzip + ETag/304 cho JSON,
 *   nén sẵn (precompress) Brotli/Gzip + cache RAM cho file tĩnh, cache headers,
 *   request log, graceful shutdown — không cần thêm dependency ngoài Express.
 */

/* Nạp biến môi trường từ server/.env (builtin Node ≥ 20.12 — không cần dependency).
 * Thiếu file (máy CI, bản sao mới) → bỏ qua, dùng giá trị mặc định.
 * Phải chạy TRƯỚC khi require lib/chat.js vì module đó đọc XKIRO_* ngay khi load. */
try { process.loadEnvFile(); } catch { /* chưa có server/.env — dùng mặc định */ }

const express = require('express');
const fs = require('fs');
const { IS_TEST, CLIENT_DIST, IMAGES_DIR } = require('./config');
const { ConfigError, createDatabase } = require('./lib/db');
const { createCatalogRepository } = require('./models/catalog.model');
const { createOrderRepository } = require('./models/order.model');
const { configureServices, products, categories } = require('./models');
const apiRouter = require('./routes');
const requestLogger = require('./middleware/request-logger');
const securityHeaders = require('./middleware/security-headers');
const cors = require('./middleware/cors');
const jsonGzip = require('./middleware/json-gzip');
const apiRateLimit = require('./middleware/rate-limit');
const apiNotFound = require('./middleware/api-not-found');
const errorHandler = require('./middleware/error-handler');
const { setupClientServing, ensurePrecompressed } = require('./middleware/serve-client');
const { validateChatConfig } = require('./lib/chat');

const app = express();
app.disable('x-powered-by'); // Ẩn fingerprint "Express" — không lộ framework đang chạy.
// Chạy sau reverse proxy (Nginx/Cloudflare…) thì đặt TRUST_PROXY (vd: 1 hoặc "loopback")
// để req.ip lấy đúng IP client từ X-Forwarded-For → rate limit không gộp nhầm mọi khách vào 1 IP.
const parseTrustProxy = (raw = process.env.TRUST_PROXY) => {
  if (raw == null || String(raw).trim() === '' || /^(false|0)$/i.test(String(raw).trim())) return false;
  const value = String(raw).trim().toLowerCase();
  if (['loopback', 'linklocal', 'uniquelocal'].includes(value)) return value;
  if (/^\d+$/.test(value)) {
    const hops = Number(value);
    if (hops >= 1 && hops <= 10) return hops;
  }
  throw new ConfigError('TRUST_PROXY chỉ nhận false/0, 1..10, loopback, linklocal hoặc uniquelocal.');
};
const trustProxy = parseTrustProxy();
if (trustProxy !== false) app.set('trust proxy', trustProxy);

if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });

/* ===== Pipeline middleware (đúng thứ tự cũ: logger → headers → parser → CORS → gzip) ===== */
app.use(requestLogger);
app.use(securityHeaders);
app.use(express.json({ limit: '100kb' }));
app.use(cors);
app.use(jsonGzip);

/* ===== API: rate limit → routes → 404 JSON ===== */
app.use('/api', apiRateLimit);
app.use('/api', apiRouter);
app.use('/api', apiNotFound);

/* ===== Ảnh (/images/*): file tĩnh, cache 30 ngày immutable =====
 * Tên file ảnh không đổi (thay ảnh = thêm file mới + sửa đường dẫn trong DB) nên cache
 * dài là an toàn: trình duyệt không tải lại ảnh đã xem → tiết kiệm băng thông, tải nhanh. */
app.use('/images', express.static(IMAGES_DIR, {
  maxAge: '30d',
  immutable: true,
  dotfiles: 'ignore',
}));

/* ===== Production: serve client build + SPA fallback ===== */
setupClientServing(app);

/* ===== Báo lỗi tập trung — luôn cuối pipeline ===== */
app.use(errorHandler);

/* ===== Khởi động / xuất cho test & deploy ===== */
let database = null;
let server = null;

const startServer = async (port = process.env.PORT || 3000, injected = null) => {
  if (server) return server;
  validateChatConfig();
  if (injected) {
    configureServices(injected);
  } else if (!IS_TEST) {
    database = createDatabase();
    try {
      await database.connect();
    } catch (error) {
      await database.close().catch(() => {});
      database = null;
      throw error;
    }
    configureServices({
      catalogRepository: createCatalogRepository({ pool: database.pool, sql: database.sql }),
      orderRepository: createOrderRepository({ pool: database.pool, sql: database.sql }),
      isReady: () => database.isReady(),
    });
  }
  ensurePrecompressed();
  server = app.listen(port, () => {
    const hasClient = fs.existsSync(CLIENT_DIST);
    console.log(`API server đang chạy tại http://localhost:${port}`);
    console.log(`  - API:      http://localhost:${port}/api/health`);
    console.log('  - Dữ liệu:  SQL Server (catalog và đơn hàng động)');
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
    // startServer chỉ được gọi trong chạy thật (test dùng app.listen) → thoát an toàn.
    process.exit(1);
  });
  return server;
};

/* Kết thúc đẹp: đóng server + pool DB. index.js đăng ký cho SIGINT/SIGTERM. */
let shuttingDown = false;
const shutdown = (signal, exitCode = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\nNhận ${signal} — đang đóng server…`);
  const finish = async () => {
    try { if (database) await database.close(); } finally { process.exit(exitCode); }
  };
  if (!server) return finish();
  server.close(finish);
  // Chốt sau 3s nếu còn kết nối treo.
  setTimeout(() => process.exit(exitCode), 3000).unref();
};

module.exports = { app, startServer, shutdown, configureServices, products, categories, parseTrustProxy };
