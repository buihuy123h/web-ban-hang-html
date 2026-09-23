'use strict';

/* MODELS — điểm hội tụ dữ liệu của backend.
 * - Controller luôn lấy repository qua getServices() → đổi nguồn dữ liệu
 *   (SQL ↔ memory) không phải sửa route/controller.
 * - Production: app.js gọi configureServices(...) với repository SQL sau khi
 *   kết nối DB (xem index.js / app.js).
 * - Test: nạp ngay memory model dựng từ data/products.json (fixture) để cả
 *   suite chạy không cần SQL Server. */

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

/* JSON chỉ là fixture cho test/seed — production đọc catalog từ SQL Server. */
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

const configureServices = (nextServices) => {
  if (!nextServices || !nextServices.catalogRepository || !nextServices.orderRepository) {
    throw new TypeError('Cần truyền catalogRepository và orderRepository.');
  }
  services = nextServices;
  readiness = typeof nextServices.isReady === 'function' ? nextServices.isReady : () => true;
};

const getServices = () => services;
const isReady = () => readiness();

module.exports = { configureServices, getServices, isReady, products, categories };
