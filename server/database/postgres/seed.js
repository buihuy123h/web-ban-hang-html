'use strict';

/* Seed catalog idempotent. Chỉ dùng MIGRATION_DATABASE_URL; không seed đơn lịch sử,
 * không ghi đè dữ liệu đã chỉnh tay và validate toàn bộ fixture trước transaction. */
try { process.loadEnvFile(); } catch { /* dùng env của shell/secret store */ }

const fs = require('node:fs');
const { ConfigError, createConfig, createDatabase } = require('../../lib/db');
const { PRODUCTS_FILE } = require('../../config');

const EXPECTED = { categories: 6, products: 21, images: 1, specs: 84 };
const PROMO_CODES = [
  { code: 'QUANGHUY10', rate: 0.1, active: true, description: 'Giảm 10% toàn đơn — mã đang áp dụng' },
  { code: 'INOX10', rate: 0.1, active: false, description: 'Mã cũ giảm 10% — đã ngừng áp dụng' },
];

const validateCatalog = (catalog) => {
  const categories = Array.isArray(catalog && catalog.categories) ? catalog.categories : [];
  const products = Array.isArray(catalog && catalog.products) ? catalog.products : [];
  const imageCount = products.reduce((count, item) => count + (Array.isArray(item.images) ? item.images.length : 0), 0);
  const specCount = products.reduce((count, item) => count + (Array.isArray(item.specs) ? item.specs.length : 0), 0);
  if (categories.length !== EXPECTED.categories || products.length !== EXPECTED.products
      || imageCount !== EXPECTED.images || specCount !== EXPECTED.specs) {
    throw new ConfigError('Fixture catalog sai số lượng mong đợi (6 categories/21 products/1 image/84 specs).');
  }
  const categoryKeys = new Set(categories.map((item) => item.key));
  const productIds = new Set(products.map((item) => item.id));
  if (categoryKeys.size !== categories.length || productIds.size !== products.length
      || products.some((item) => !Number.isInteger(item.id) || item.id <= 0 || !categoryKeys.has(item.category))) {
    throw new ConfigError('Fixture catalog có khóa trùng/không hợp lệ hoặc category không tồn tại.');
  }
  return { categories, products };
};

const run = async ({ pgModule } = {}) => {
  const catalog = validateCatalog(JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8')));
  const config = createConfig({ urlEnv: 'MIGRATION_DATABASE_URL' });
  const db = createDatabase({ pgModule, config });
  let client;
  let inserted = 0;
  try {
    client = await db.pool.connect();
    await client.query('BEGIN');
    for (const category of catalog.categories) {
      const result = await client.query(
        `INSERT INTO app.categories(category_key, label, image_url) VALUES ($1, $2, $3)
         ON CONFLICT (category_key) DO NOTHING`,
        [category.key, category.label, category.image || null],
      );
      inserted += result.rowCount;
    }
    for (const product of catalog.products) {
      const result = await client.query(
        `INSERT INTO app.products
          (product_id, name, category_key, price, old_price, rating, sold, badge, description, image_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (product_id) DO NOTHING`,
        [product.id, product.name, product.category, product.price, product.oldPrice ?? null,
          product.rating, product.sold, product.badge ?? null, product.description, product.image ?? null],
      );
      inserted += result.rowCount;
      for (const [index, url] of (product.images || []).entries()) {
        const image = await client.query(
          `INSERT INTO app.product_images(product_id, sort_order, url) VALUES ($1,$2,$3)
           ON CONFLICT (product_id, sort_order) DO NOTHING`, [product.id, index + 1, url],
        );
        inserted += image.rowCount;
      }
      for (const [index, text] of (product.specs || []).entries()) {
        const spec = await client.query(
          `INSERT INTO app.product_specs(product_id, sort_order, spec_text) VALUES ($1,$2,$3)
           ON CONFLICT (product_id, sort_order) DO NOTHING`, [product.id, index + 1, text],
        );
        inserted += spec.rowCount;
      }
    }
    for (const promo of PROMO_CODES) {
      const result = await client.query(
        `INSERT INTO app.promo_codes(code, discount_rate, is_active, description) VALUES ($1,$2,$3,$4)
         ON CONFLICT (code) DO NOTHING`, [promo.code, promo.rate, promo.active, promo.description],
      );
      inserted += result.rowCount;
    }
    await client.query('COMMIT');
    console.log(`[seed] inserted=${inserted}`);
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    if (client) client.release();
    await db.close().catch(() => {});
  }
};

if (require.main === module) {
  run().catch((error) => {
    if (error instanceof ConfigError) console.error(`[config] ${error.message}`);
    else console.error(`[seed] Thất bại: ${String(error && error.code || 'SEED_FAILED')}`);
    process.exitCode = 1;
  });
}

module.exports = { run, validateCatalog, EXPECTED };
