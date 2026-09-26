'use strict';

/* Cấu hình dùng chung cho toàn bộ server — đọc 1 lần khi load module.
 * Biến môi trường riêng của từng mảng (DB, xKiro, rate limit) nằm ở lib/db.js,
 * lib/chat.js, middleware/rate-limit.js cho gần nơi sử dụng. */

const path = require('path');
const PKG = require('./package.json');

/* Chạy test (npm test / node --test) → dùng memory model + fixture, không đụng PostgreSQL. */
const IS_TEST = process.env.NODE_ENV === 'test' || process.env.npm_lifecycle_event === 'test';

const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, 'data');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json'); // fixture cho test/seed
// Ảnh thật (danh mục + sản phẩm) phục vụ tại /images/* — DB chỉ lưu đường dẫn tương đối.
const IMAGES_DIR = path.join(ROOT_DIR, 'public', 'images');
const CLIENT_DIST = path.resolve(ROOT_DIR, '..', 'client', 'dist'); // bản build FE để serve production

module.exports = { PKG, IS_TEST, ROOT_DIR, DATA_DIR, PRODUCTS_FILE, IMAGES_DIR, CLIENT_DIST };
