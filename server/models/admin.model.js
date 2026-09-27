'use strict';

const mapProduct = (row) => ({
  id: Number(row.product_id), name: row.name, category: row.category_key, categoryLabel: row.category_label,
  price: Number(row.price), oldPrice: row.old_price == null ? null : Number(row.old_price), rating: Number(row.rating),
  sold: Number(row.sold), badge: row.badge, description: row.description, image: row.image_url || null, images: [], specs: [],
});

const mapOrder = (row) => ({
  id: Number(row.order_id), code: row.order_code, status: row.status || 'new', delivery: row.delivery_method,
  payment: row.payment_method, promoCode: row.promo_code || null, subtotal: Number(row.subtotal),
  shippingFee: Number(row.shipping_fee), discount: Number(row.discount), total: Number(row.total),
  customer: { name: row.customer_name, phone: row.customer_phone, address: row.customer_address, note: row.note || '' },
  createdAt: new Date(row.created_at).toISOString(), items: row.items || [],
});

const createAdminRepository = ({ pool }) => ({
  async listProducts() {
    const { rows } = await pool.query('SELECT p.*, c.label AS category_label FROM app.products p JOIN app.categories c ON c.category_key=p.category_key ORDER BY p.product_id DESC');
    return rows.map(mapProduct);
  },
  async createProduct(input) {
    const { rows } = await pool.query(`INSERT INTO app.products(product_id,name,category_key,price,old_price,rating,sold,badge,description,image_url)
      VALUES ((SELECT COALESCE(MAX(product_id),0)+1 FROM app.products),$1,$2,$3,$4,$5,0,$6,$7,$8)
      RETURNING *`, [input.name, input.category, input.price, input.oldPrice || null, input.rating || 0, input.badge || null, input.description, input.image || null]);
    return mapProduct(rows[0]);
  },
  async updateProduct(id, input) {
    const { rows } = await pool.query(`UPDATE app.products SET name=$1,category_key=$2,price=$3,old_price=$4,rating=$5,badge=$6,description=$7,image_url=$8 WHERE product_id=$9 RETURNING *`, [input.name, input.category, input.price, input.oldPrice || null, input.rating || 0, input.badge || null, input.description, input.image || null, id]);
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
});

module.exports = { createAdminRepository };