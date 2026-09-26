'use strict';

/* MODELS — điểm hội tụ dữ liệu của backend.
 * - Controller luôn lấy repository qua getServices() → đổi nguồn dữ liệu
 *   (PostgreSQL ↔ memory) không phải sửa route/controller.
 * - Production: app.js gọi configureServices(...) với repository SQL sau khi
 *   kết nối DB (xem index.js / app.js).
 * - Test: nạp ngay memory model dựng từ data/products.json (fixture) để cả
 *   suite chạy không cần PostgreSQL. */

const fs = require('fs');
const { IS_TEST, PRODUCTS_FILE } = require('../config');
const { createMemoryRepositories } = require('./memory.model');

const readJson = (file, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
};

/* JSON chỉ là fixture cho test/seed — production đọc catalog từ PostgreSQL (Supabase). */
const testCatalog = IS_TEST ? readJson(PRODUCTS_FILE, { categories: [], products: [] }) : { categories: [], products: [] };
const categories = Array.isArray(testCatalog.categories) ? testCatalog.categories : [];
const products = Array.isArray(testCatalog.products) ? testCatalog.products : [];

/* Dữ liệu fixture cũ có thể thiếu trường ảnh → tự điền rỗng để API luôn trả đủ image/images. */
for (const product of products) {
  if (!product.image) product.image = null;
  if (!Array.isArray(product.images)) product.images = [];
}

let services = IS_TEST ? createMemoryRepositories({ categories, products }) : null;
let readiness = () => Boolean(services);
let poolStats = null;    // hàm trả {total, idle, waiting} | null — chỉ production tiêm (health check)
let databasePing = null; // async hàm trả ms — chỉ production tiêm (deep health)

const configureServices = (nextServices) => {
  if (!nextServices || !nextServices.catalogRepository || !nextServices.orderRepository) {
    throw new TypeError('Cần truyền catalogRepository và orderRepository.');
  }
  services = nextServices;
  readiness = typeof nextServices.isReady === 'function' ? nextServices.isReady : () => true;
  /* 2 field optional cho observability — object cũ không có vẫn hợp lệ như trước (additive). */
  poolStats = typeof nextServices.poolStats === 'function' ? nextServices.poolStats : null;
  databasePing = typeof nextServices.pingDatabase === 'function' ? nextServices.pingDatabase : null;
};

const getServices = () => services;
const isReady = () => readiness();

/* Trạng thái pool cho /api/health — KHÔNG ném lỗi (hàm tiêm ném lỗi → trả null). */
const getPoolStats = () => {
  try {
    return typeof poolStats === 'function' ? poolStats() : null;
  } catch {
    return null;
  }
};

/* Hàm ping DB cho deep health (?deep=1) — trả hàm hoặc null (memory/test mode). */
const getDatabasePing = () => databasePing;

module.exports = { configureServices, getServices, isReady, getPoolStats, getDatabasePing, products, categories };
