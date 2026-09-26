'use strict';

/* MODEL — danh mục + sản phẩm đọc từ PostgreSQL (bảng categories, products; ảnh/spec
 * gộp sẵn bằng json_agg nên 1 sản phẩm = 1 dòng). Tên cột được alias về PascalCase
 * ("ProductId"…) để mapProduct và hợp đồng API giữ nguyên như bản SQL Server.
 * Input người dùng (cat/q/id/limit) LUÔN đi qua placeholder $1, $2… — không nối chuỗi.
 * Tìm kiếm dùng unaccent + ILIKE để khớp cả từ khoá không dấu (tương đương collation
 * Vietnamese_CI_AI cũ). */

const toNumber = (value) => (value == null ? null : Number(value));
const parseJsonArray = (value) => {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const mapProduct = (row) => ({
  id: Number(row.ProductId),
  name: row.Name,
  category: row.CategoryKey,
  categoryLabel: row.CategoryLabel,
  price: Number(row.Price),
  oldPrice: toNumber(row.OldPrice),
  rating: Number(row.Rating),
  sold: Number(row.Sold),
  badge: row.Badge,
  description: row.Description,
  image: row.ImageUrl || null,
  images: parseJsonArray(row.ImagesJson).map((item) => item.url),
  specs: parseJsonArray(row.SpecsJson).map((item) => item.text),
});

const PRODUCT_SELECT = `
SELECT p.product_id AS "ProductId", p.name AS "Name", p.category_key AS "CategoryKey",
       c.label AS "CategoryLabel",
       p.price AS "Price", p.old_price AS "OldPrice", p.rating AS "Rating", p.sold AS "Sold",
       p.badge AS "Badge", p.description AS "Description", p.image_url AS "ImageUrl",
       COALESCE((SELECT json_agg(json_build_object('url', pi.url) ORDER BY pi.sort_order)
                 FROM app.product_images AS pi WHERE pi.product_id = p.product_id), '[]'::json) AS "ImagesJson",
       COALESCE((SELECT json_agg(json_build_object('text', ps.spec_text) ORDER BY ps.sort_order)
                 FROM app.product_specs AS ps WHERE ps.product_id = p.product_id), '[]'::json) AS "SpecsJson"
FROM app.products AS p
INNER JOIN app.categories AS c ON c.category_key = p.category_key`;

const createCatalogRepository = ({ pool }) => ({
  async listCategories() {
    const result = await pool.query('SELECT category_key AS "key", label AS "label", image_url AS "image" FROM app.categories ORDER BY category_key ASC;');
    return result.rows.map((row) => ({ key: row.key, label: row.label, image: row.image || null }));
  },

  async listProducts({ cat, q, sort } = {}) {
    const values = [];
    const where = [];
    if (cat && cat !== 'all') {
      values.push(String(cat));
      where.push(`p.category_key = $${values.length}`);
    }
    const query = String(q || '').trim();
    if (query) {
      values.push(`%${query}%`);
      where.push(`extensions.unaccent(p.name) ILIKE extensions.unaccent($${values.length})`);
    }
    const orderBy = {
      'price-asc': 'p.price ASC, p.product_id ASC',
      'price-desc': 'p.price DESC, p.product_id ASC',
      rating: 'p.rating DESC, p.product_id ASC',
    }[sort] || 'p.sold DESC, p.product_id ASC';
    const result = await pool.query(
      `${PRODUCT_SELECT}\n${where.length ? `WHERE ${where.join(' AND ')}` : ''}\nORDER BY ${orderBy};`,
      values,
    );
    return result.rows.map(mapProduct);
  },

  async getProductById(id) {
    const result = await pool.query(`${PRODUCT_SELECT}\nWHERE p.product_id = $1;`, [Number(id)]);
    return result.rows[0] ? mapProduct(result.rows[0]) : null;
  },

  async listRelatedProducts(categoryKey, excludedId, limit = 4) {
    const safeLimit = Math.min(20, Math.max(1, Number(limit) || 4));
    const result = await pool.query(
      `${PRODUCT_SELECT}\nWHERE p.category_key = $1 AND p.product_id <> $2\nORDER BY p.sold DESC, p.product_id ASC\nLIMIT $3;`,
      [categoryKey, Number(excludedId), safeLimit],
    );
    return result.rows.map(mapProduct);
  },
});

module.exports = { createCatalogRepository, mapProduct };
