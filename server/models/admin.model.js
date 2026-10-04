'use strict';

const mapProduct = (row) => ({
  id: Number(row.product_id), name: row.name, category: row.category_key, categoryLabel: row.category_label,
  price: Number(row.price), oldPrice: row.old_price == null ? null : Number(row.old_price), costPrice: Number(row.cost_price || 0), rating: Number(row.rating),
  sold: Number(row.sold), badge: row.badge, description: row.description, image: row.image_url || null, images: [], specs: [],
});

const mapOrder = (row) => ({
  id: Number(row.order_id), code: row.order_code, status: row.status || 'new', delivery: row.delivery_method,
  payment: row.payment_method, promoCode: row.promo_code || null, subtotal: Number(row.subtotal),
  shippingFee: Number(row.shipping_fee), discount: Number(row.discount), total: Number(row.total),
  customer: { name: row.customer_name, phone: row.customer_phone, address: row.customer_address, note: row.note || '' },
  createdAt: new Date(row.created_at).toISOString(), items: row.items || [],
});

const mapCategory = (row) => ({
  key: row.category_key, label: row.label, image: row.image_url || null, productCount: Number(row.product_count || 0),
});

const mapFeedback = (row) => ({
  id: Number(row.feedback_id), customerName: row.customer_name, phone: row.phone || '', message: row.message,
  rating: Number(row.rating), status: row.status || 'new', createdAt: new Date(row.created_at).toISOString(),
});

const createAdminRepository = ({ pool }) => ({
  async listProducts() {
    const { rows } = await pool.query('SELECT p.*, c.label AS category_label FROM app.products p JOIN app.categories c ON c.category_key=p.category_key ORDER BY p.product_id DESC');
    return rows.map(mapProduct);
  },
  async createProduct(input) {
    const { rows } = await pool.query(`INSERT INTO app.products(product_id,name,category_key,price,old_price,cost_price,rating,sold,badge,description,image_url)
      VALUES ((SELECT COALESCE(MAX(product_id),0)+1 FROM app.products),$1,$2,$3,$4,$5,$6,0,$7,$8,$9)
      RETURNING *`, [input.name, input.category, input.price, input.oldPrice || null, input.costPrice == null ? 0 : input.costPrice, input.rating || 0, input.badge || null, input.description, input.image || null]);
    return mapProduct(rows[0]);
  },
  async updateProduct(id, input) {
    const { rows } = await pool.query(`UPDATE app.products SET name=$1,category_key=$2,price=$3,old_price=$4,cost_price=$5,rating=$6,badge=$7,description=$8,image_url=$9 WHERE product_id=$10 RETURNING *`, [input.name, input.category, input.price, input.oldPrice || null, input.costPrice == null ? 0 : input.costPrice, input.rating || 0, input.badge || null, input.description, input.image || null, id]);
    return rows[0] ? mapProduct(rows[0]) : null;
  },
  async deleteProduct(id) {
    const used = await pool.query('SELECT 1 FROM app.order_items WHERE product_id=$1 LIMIT 1', [id]);
    if (used.rowCount) { const error = new Error('Không thể xóa sản phẩm đã có trong đơn hàng.'); error.status = 409; error.isBusinessError = true; throw error; }
    const result = await pool.query('DELETE FROM app.products WHERE product_id=$1', [id]); return result.rowCount > 0;
  },
  async listPosts() { const { rows } = await pool.query('SELECT * FROM app.admin_posts ORDER BY updated_at DESC'); return rows; },
  async createPost(input) { const { rows } = await pool.query('INSERT INTO app.admin_posts(title,slug,excerpt,content,status,image_url) VALUES($1,$2,$3,$4,$5,$6) RETURNING *', [input.title, input.slug, input.excerpt || '', input.content, input.status || 'draft', input.image || null]); return rows[0]; },
  async updatePost(id, input) { const { rows } = await pool.query('UPDATE app.admin_posts SET title=$1,slug=$2,excerpt=$3,content=$4,status=$5,image_url=$6,updated_at=now() WHERE post_id=$7 RETURNING *', [input.title, input.slug, input.excerpt || '', input.content, input.status || 'draft', input.image || null, id]); return rows[0] || null; },
  async deletePost(id) { const result = await pool.query('DELETE FROM app.admin_posts WHERE post_id=$1', [id]); return result.rowCount > 0; },
  async listOrders() { const { rows } = await pool.query(`SELECT o.*, COALESCE((SELECT json_agg(json_build_object('id',i.product_id,'name',i.product_name,'price',i.unit_price,'qty',i.qty)) FROM app.order_items i WHERE i.order_id=o.order_id),'[]') items FROM app.orders o ORDER BY o.created_at DESC`); return rows.map(mapOrder); },
  async getOrder(id) { const { rows } = await pool.query(`SELECT o.*, COALESCE((SELECT json_agg(json_build_object('id',i.product_id,'name',i.product_name,'price',i.unit_price,'qty',i.qty)) FROM app.order_items i WHERE i.order_id=o.order_id),'[]') items FROM app.orders o WHERE o.order_id=$1`, [id]); return rows[0] ? mapOrder(rows[0]) : null; },
  async updateOrderStatus(id, status) { const { rows } = await pool.query('UPDATE app.orders SET status=$1 WHERE order_id=$2 RETURNING *', [status, id]); return rows[0] ? this.getOrder(id) : null; },
  async getStore() { const { rows } = await pool.query('SELECT * FROM app.store_settings WHERE store_id=1'); return rows[0]; },
  async updateStore(input) { const { rows } = await pool.query('UPDATE app.store_settings SET name=$1,phone=$2,address=$3,description=$4,opening_hours=$5,facebook_url=$6,updated_at=now() WHERE store_id=1 RETURNING *', [input.name, input.phone, input.address, input.description, input.openingHours, input.facebookUrl]); return rows[0]; },
  async listCustomers() {
    const { rows } = await pool.query(`SELECT customer_phone, MAX(customer_name) AS customer_name, COUNT(*) AS order_count,
      COALESCE(SUM(total) FILTER (WHERE status <> 'cancelled'), 0) AS total_spent, MAX(created_at) AS last_order_at
      FROM app.orders GROUP BY customer_phone ORDER BY last_order_at DESC`);
    return rows.map((row) => ({
      phone: row.customer_phone || '', name: row.customer_name || 'Không tên',
      orderCount: Number(row.order_count), totalSpent: Number(row.total_spent),
      lastOrderAt: row.last_order_at ? new Date(row.last_order_at).toISOString() : null,
    }));
  },
  async listFeedback() {
    const { rows } = await pool.query('SELECT * FROM app.feedback ORDER BY created_at DESC');
    return rows.map(mapFeedback);
  },
  async createFeedback(input) {
    const { rows } = await pool.query('INSERT INTO app.feedback(customer_name,phone,message,rating) VALUES($1,$2,$3,$4) RETURNING *', [input.customerName, input.phone || '', input.message, input.rating || 5]);
    return mapFeedback(rows[0]);
  },
  async updateFeedbackStatus(id, status) {
    const { rows } = await pool.query('UPDATE app.feedback SET status=$1 WHERE feedback_id=$2 RETURNING *', [status, id]);
    return rows[0] ? mapFeedback(rows[0]) : null;
  },
  async deleteFeedback(id) {
    const result = await pool.query('DELETE FROM app.feedback WHERE feedback_id=$1', [id]);
    return result.rowCount > 0;
  },
  async getProfitReport() {
    const estimated = 'COALESCE(p.cost_price, ROUND(i.unit_price * 0.7))';
    const { rows: [totals] } = await pool.query(`SELECT COUNT(*) AS order_count, COALESCE(SUM(o.subtotal),0) AS revenue,
      COALESCE(SUM(o.shipping_fee),0) AS shipping, COALESCE(SUM(o.discount),0) AS discount, COALESCE(SUM(i.qty * ${estimated}),0) AS cost
      FROM app.orders o JOIN app.order_items i ON i.order_id = o.order_id
      LEFT JOIN app.products p ON p.product_id = i.product_id WHERE o.status <> 'cancelled'`);
    const { rows: monthly } = await pool.query(`SELECT to_char(date_trunc('month', o.created_at), 'YYYY-MM') AS month,
      COUNT(DISTINCT o.order_id) AS order_count, COALESCE(SUM(i.qty * i.unit_price),0) AS revenue,
      COALESCE(SUM(i.qty * ${estimated}),0) AS cost
      FROM app.orders o JOIN app.order_items i ON i.order_id = o.order_id
      LEFT JOIN app.products p ON p.product_id = i.product_id WHERE o.status <> 'cancelled'
      GROUP BY 1 ORDER BY 1 DESC LIMIT 12`);
    const { rows: topProducts } = await pool.query(`SELECT i.product_name AS name, SUM(i.qty) AS qty,
      COALESCE(SUM(i.qty * i.unit_price),0) AS revenue, COALESCE(SUM(i.qty * ${estimated}),0) AS cost
      FROM app.orders o JOIN app.order_items i ON i.order_id = o.order_id
      LEFT JOIN app.products p ON p.product_id = i.product_id WHERE o.status <> 'cancelled'
      GROUP BY i.product_name ORDER BY revenue DESC LIMIT 5`);
    return {
      totals: { orderCount: Number(totals.order_count), revenue: Number(totals.revenue), shipping: Number(totals.shipping), discount: Number(totals.discount), cost: Number(totals.cost), profit: Number(totals.revenue) - Number(totals.cost) },
      monthly: monthly.map((row) => ({ month: row.month, orderCount: Number(row.order_count), revenue: Number(row.revenue), cost: Number(row.cost), profit: Number(row.revenue) - Number(row.cost) })),
      topProducts: topProducts.map((row) => ({ name: row.name, qty: Number(row.qty), revenue: Number(row.revenue), cost: Number(row.cost), profit: Number(row.revenue) - Number(row.cost) })),
    };
  },
  async getSystem() {
    const { rows } = await pool.query('SELECT * FROM app.system_settings WHERE setting_id=1');
    return rows[0] || null;
  },
  async updateSystem(input) {
    const { rows } = await pool.query(`UPDATE app.system_settings SET shipping_fee=$1, free_shipping_threshold=$2, maintenance_mode=$3, announcement=$4, updated_at=now() WHERE setting_id=1 RETURNING *`, [input.shippingFee, input.freeShippingThreshold, !!input.maintenanceMode, input.announcement || '']);
    return rows[0];
  },
  async listAdminCategories() {
    const { rows } = await pool.query(`SELECT c.category_key, c.label, c.image_url,
      (SELECT COUNT(*) FROM app.products p WHERE p.category_key = c.category_key) AS product_count
      FROM app.categories c ORDER BY c.label`);
    return rows.map(mapCategory);
  },
  async createCategory(input) {
    const { rows } = await pool.query('INSERT INTO app.categories(category_key,label,image_url) VALUES($1,$2,$3) RETURNING category_key, label, image_url', [input.key, input.label, input.image]);
    return mapCategory(rows[0]);
  },
  async updateCategory(key, input) {
    const { rows } = await pool.query(`UPDATE app.categories SET label=$1, image_url=$2 WHERE category_key=$3
      RETURNING category_key, label, image_url,
      (SELECT COUNT(*) FROM app.products p WHERE p.category_key = app.categories.category_key) AS product_count`, [input.label, input.image, key]);
    return rows[0] ? mapCategory(rows[0]) : null;
  },
  async deleteCategory(key) {
    const used = await pool.query('SELECT 1 FROM app.products WHERE category_key=$1 LIMIT 1', [key]);
    if (used.rowCount) { const error = new Error('Không thể xóa danh mục đang có sản phẩm. Hãy chuyển sản phẩm sang danh mục khác trước.'); error.status = 409; error.isBusinessError = true; throw error; }
    const result = await pool.query('DELETE FROM app.categories WHERE category_key=$1', [key]);
    return result.rowCount > 0;
  },
});

module.exports = { createAdminRepository };