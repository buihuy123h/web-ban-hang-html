'use strict';

/* MODEL — danh mục + sản phẩm đọc từ SQL Server (dbo.Categories, dbo.Products,
 * ảnh/spec gộp qua FOR JSON PATH). Tách từ lib/catalog-repository.js khi chuẩn hoá
 * cấu trúc MVC; logic giữ nguyên 100%. Luôn bind input (@category/@search/@id…)
 * — không nối giá trị người dùng vào chuỗi SQL. */

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
SELECT p.ProductId, p.Name, p.CategoryKey, c.Label AS CategoryLabel,
       p.Price, p.OldPrice, p.Rating, p.Sold, p.Badge,
       p.[Description] AS [Description], p.ImageUrl,
       COALESCE((SELECT pi.Url AS [url] FROM dbo.ProductImages AS pi
                 WHERE pi.ProductId = p.ProductId ORDER BY pi.SortOrder FOR JSON PATH), N'[]') AS ImagesJson,
       COALESCE((SELECT ps.SpecText AS [text] FROM dbo.ProductSpecs AS ps
                 WHERE ps.ProductId = p.ProductId ORDER BY ps.SortOrder FOR JSON PATH), N'[]') AS SpecsJson
FROM dbo.Products AS p
INNER JOIN dbo.Categories AS c ON c.CategoryKey = p.CategoryKey`;

const createCatalogRepository = ({ pool, sql }) => ({
  async listCategories() {
    const result = await pool.request().query(`
      SELECT CategoryKey AS [key], Label AS label, ImageUrl AS [image]
      FROM dbo.Categories
      ORDER BY CategoryKey ASC;`);
    return result.recordset.map((row) => ({ key: row.key, label: row.label, image: row.image || null }));
  },

  async listProducts({ cat, q, sort } = {}) {
    const request = pool.request();
    const where = [];
    if (cat && cat !== 'all') {
      request.input('category', sql.NVarChar(50), String(cat));
      where.push('p.CategoryKey = @category');
    }
    const query = String(q || '').trim();
    if (query) {
      request.input('search', sql.NVarChar(200), `%${query}%`);
      where.push("p.Name COLLATE Vietnamese_100_CI_AI LIKE @search COLLATE Vietnamese_100_CI_AI");
    }
    const orderBy = {
      'price-asc': 'p.Price ASC, p.ProductId ASC',
      'price-desc': 'p.Price DESC, p.ProductId ASC',
      rating: 'p.Rating DESC, p.ProductId ASC',
    }[sort] || 'p.Sold DESC, p.ProductId ASC';
    const result = await request.query(`${PRODUCT_SELECT}\n${where.length ? `WHERE ${where.join(' AND ')}` : ''}\nORDER BY ${orderBy};`);
    return result.recordset.map(mapProduct);
  },

  async getProductById(id) {
    const result = await pool.request()
      .input('id', sql.Int, Number(id))
      .query(`${PRODUCT_SELECT}\nWHERE p.ProductId = @id;`);
    return result.recordset[0] ? mapProduct(result.recordset[0]) : null;
  },

  async listRelatedProducts(categoryKey, excludedId, limit = 4) {
    const safeLimit = Math.min(20, Math.max(1, Number(limit) || 4));
    const result = await pool.request()
      .input('category', sql.NVarChar(50), categoryKey)
      .input('excludedId', sql.Int, Number(excludedId))
      .input('limit', sql.Int, safeLimit)
      .query(`${PRODUCT_SELECT}\nWHERE p.CategoryKey = @category AND p.ProductId <> @excludedId\nORDER BY p.Sold DESC, p.ProductId ASC\nOFFSET 0 ROWS FETCH NEXT @limit ROWS ONLY;`);
    return result.recordset.map(mapProduct);
  },
});

module.exports = { createCatalogRepository, mapProduct };
