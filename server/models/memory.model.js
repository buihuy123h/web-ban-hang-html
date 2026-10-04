'use strict';

const { mapPost } = require('./posts.model');

/* MODEL nhớ trong RAM — dựng từ data/products.json; dùng cho test và demo khi
 * không cần PostgreSQL. Tách từ lib/memory-repositories.js khi chuẩn hoá cấu
 * trúc MVC; logic giữ nguyên 100%, hành vi mô phỏng sát model SQL
 * (lọc/tìm/sắp xếp, tính phí ship, mã giảm giá QUANGHUY10). */

const createMemoryRepositories = ({ categories = [], products = [], posts = [] } = {}) => {
  const productMap = new Map(products.map((product) => [Number(product.id), product]));
  let sequence = 10;
  const catalogRepository = {
    async listCategories() { return categories.map((item) => ({ ...item })); },
    async listProducts({ cat, q, sort } = {}) {
      let list = products.map((item) => ({ ...item, images: [...(item.images || [])], specs: [...(item.specs || [])] }));
      if (cat && cat !== 'all') list = list.filter((item) => item.category === cat);
      const needle = String(q || '').trim().toLocaleLowerCase('vi');
      if (needle) list = list.filter((item) => item.name.toLocaleLowerCase('vi').includes(needle));
      const compare = {
        'price-asc': (a, b) => a.price - b.price || a.id - b.id,
        'price-desc': (a, b) => b.price - a.price || a.id - b.id,
        rating: (a, b) => b.rating - a.rating || a.id - b.id,
      }[sort] || ((a, b) => b.sold - a.sold || a.id - b.id);
      return list.sort(compare);
    },
    async getProductById(id) { return productMap.get(Number(id)) || null; },
    async listRelatedProducts(categoryKey, excludedId, limit = 4) {
      return products.filter((item) => item.category === categoryKey && item.id !== Number(excludedId)).slice(0, limit);
    },
  };

  const orders = [];
  const postItems = posts;
  const feedbackItems = [];
  let store = { store_id: 1, name: 'Đồ Cũ Quang Huy', phone: '', address: '', description: '', opening_hours: '', facebook_url: '' };
  let systemSettings = { setting_id: 1, shipping_fee: 30000, free_shipping_threshold: 500000, maintenance_mode: false, announcement: '', updated_at: new Date().toISOString() };
  const estimateCost = (item) => { const product = productMap.get(Number(item.id)); const cost = product && product.costPrice != null ? product.costPrice : Math.round(item.price * 0.7); return item.qty * cost; };
  const categoryItems = categories;
  const adminRepository = {
    async listProducts() { return products.map((item) => ({ ...item })); },
    async createProduct(input) { const product = { id: Math.max(0, ...products.map((item) => Number(item.id))) + 1, ...input, oldPrice: input.oldPrice || null, rating: input.rating || 0, sold: 0, images: [], specs: [] }; products.push(product); productMap.set(product.id, product); return { ...product }; },
    async updateProduct(id, input) { const product = productMap.get(Number(id)); if (!product) return null; Object.assign(product, input); return { ...product }; },
    async deleteProduct(id) {
      const productId = Number(id);
      const usedInOrder = orders.some((order) => order.items.some((item) => Number(item.id) === productId));
      if (usedInOrder) {
        const error = new Error('Không thể xóa sản phẩm đã có trong đơn hàng.');
        error.status = 409;
        error.isBusinessError = true;
        throw error;
      }
      const index = products.findIndex((item) => Number(item.id) === productId);
      if (index < 0) return false;
      products.splice(index, 1);
      productMap.delete(productId);
      return true;
    },
    async listPosts() { return postItems.map((item) => ({ ...item })); },
    async createPost(input) { const now = new Date().toISOString(); const post = { post_id: postItems.length + 1, created_at: now, updated_at: now, ...input }; postItems.push(post); return { ...post }; },
    async updatePost(id, input) { const post = postItems.find((item) => item.post_id === Number(id)); if (!post) return null; Object.assign(post, input, { updated_at: new Date().toISOString() }); return { ...post }; },
    async deletePost(id) { const index = postItems.findIndex((item) => item.post_id === Number(id)); if (index < 0) return false; postItems.splice(index, 1); return true; },
    async listPublishedPosts() { return postItems.filter((item) => item.status === 'published').sort((a, b) => new Date(b.updated_at || b.updatedAt) - new Date(a.updated_at || a.updatedAt) || Number(b.post_id ?? b.id) - Number(a.post_id ?? a.id)).map(mapPost); },
    async getPublishedPostBySlug(slug) { const post = postItems.find((item) => item.slug === slug && item.status === 'published'); return post ? mapPost(post) : null; },
    async listOrders() { return orders.map((item) => ({ ...item })); },
    async getOrder(id) { return orders.find((item) => item.id === Number(id)) || null; },
    async updateOrderStatus(id, status) { const order = orders.find((item) => item.id === Number(id)); if (!order) return null; order.status = status; return { ...order }; },
    async getStore() { return { ...store }; },
    async updateStore(input) { store = { ...store, name: input.name, phone: input.phone, address: input.address, description: input.description, opening_hours: input.openingHours, facebook_url: input.facebookUrl }; return { ...store }; },
    async listAdminCategories() { return categoryItems.map((item) => ({ ...item, productCount: products.filter((product) => product.category === item.key).length })); },
    async createCategory(input) {
      if (categoryItems.some((item) => item.key === input.key)) { const error = new Error('Mã danh mục đã tồn tại.'); error.code = '23505'; throw error; }
      const category = { key: input.key, label: input.label, image: input.image || null };
      categoryItems.push(category);
      return { ...category, productCount: 0 };
    },
    async updateCategory(key, input) {
      const category = categoryItems.find((item) => item.key === key);
      if (!category) return null;
      Object.assign(category, { label: input.label, image: input.image || null });
      return { ...category, productCount: products.filter((product) => product.category === key).length };
    },
    async listCustomers() {
      const byPhone = new Map();
      for (const order of orders) {
        const phone = order.customer?.phone || '';
        const current = byPhone.get(phone) || { phone, name: order.customer?.name || 'Không tên', orderCount: 0, totalSpent: 0, lastOrderAt: null };
        current.orderCount += 1;
        if (order.status !== 'cancelled') current.totalSpent += Number(order.total || 0);
        if (!current.lastOrderAt || new Date(order.createdAt) > new Date(current.lastOrderAt)) { current.lastOrderAt = order.createdAt; if (order.customer?.name) current.name = order.customer.name; }
        byPhone.set(phone, current);
      }
      return [...byPhone.values()].sort((a, b) => new Date(b.lastOrderAt) - new Date(a.lastOrderAt));
    },
    async listFeedback() { return feedbackItems.map((item) => ({ ...item })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); },
    async createFeedback(input) {
      const item = { id: Math.max(0, ...feedbackItems.map((entry) => entry.id)) + 1, customerName: input.customerName, phone: input.phone || '', message: input.message, rating: input.rating || 5, status: 'new', createdAt: new Date().toISOString() };
      feedbackItems.push(item);
      return { ...item };
    },
    async updateFeedbackStatus(id, status) { const item = feedbackItems.find((entry) => entry.id === Number(id)); if (!item) return null; item.status = status; return { ...item }; },
    async deleteFeedback(id) { const index = feedbackItems.findIndex((entry) => entry.id === Number(id)); if (index < 0) return false; feedbackItems.splice(index, 1); return true; },
    async getProfitReport() {
      const valid = orders.filter((order) => order.status !== 'cancelled');
      const allItems = valid.flatMap((order) => order.items || []);
      const revenue = allItems.reduce((sum, item) => sum + item.price * item.qty, 0);
      const cost = allItems.reduce((sum, item) => sum + estimateCost(item), 0);
      const byMonth = new Map();
      for (const order of valid) {
        const month = String(order.createdAt).slice(0, 7);
        const bucket = byMonth.get(month) || { month, orderCount: 0, revenue: 0, cost: 0 };
        bucket.orderCount += 1;
        for (const item of order.items || []) { bucket.revenue += item.price * item.qty; bucket.cost += estimateCost(item); }
        byMonth.set(month, bucket);
      }
      const byProduct = new Map();
      for (const item of allItems) {
        const bucket = byProduct.get(item.name) || { name: item.name, qty: 0, revenue: 0, cost: 0 };
        bucket.qty += item.qty; bucket.revenue += item.price * item.qty; bucket.cost += estimateCost(item);
        byProduct.set(item.name, bucket);
      }
      const topProducts = [...byProduct.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5)
        .map((item) => ({ ...item, profit: item.revenue - item.cost }));
      return {
        totals: { orderCount: valid.length, revenue, shipping: valid.reduce((s, o) => s + o.shippingFee, 0), discount: valid.reduce((s, o) => s + o.discount, 0), cost, profit: revenue - cost },
        monthly: [...byMonth.values()].sort((a, b) => b.month.localeCompare(a.month)).slice(0, 12).map((item) => ({ ...item, profit: item.revenue - item.cost })),
        topProducts,
      };
    },
    async getSystem() { return { ...systemSettings }; },
    async updateSystem(input) {
      systemSettings = { ...systemSettings, shipping_fee: input.shippingFee, free_shipping_threshold: input.freeShippingThreshold, maintenance_mode: !!input.maintenanceMode, announcement: input.announcement || '', updated_at: new Date().toISOString() };
      return { ...systemSettings };
    },
    async deleteCategory(key) {
      if (products.some((product) => product.category === key)) {
        const error = new Error('Không thể xóa danh mục đang có sản phẩm. Hãy chuyển sản phẩm sang danh mục khác trước.');
        error.status = 409;
        error.isBusinessError = true;
        throw error;
      }
      const index = categoryItems.findIndex((item) => item.key === key);
      if (index < 0) return false;
      categoryItems.splice(index, 1);
      return true;
    },
  };

  const orderRepository = {
    async createOrder(input) {
      const items = input.items.map(({ id, qty }) => {
        const product = productMap.get(Number(id));
        if (!product) {
          const error = new Error(`Sản phẩm không tồn tại (id: ${id}).`);
          error.status = 400;
          error.isBusinessError = true;
          throw error;
        }
        return { id: product.id, name: product.name, price: product.price, qty };
      });
      const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
      const shippingFee = input.delivery === 'express' ? 45000 : (subtotal >= 500000 ? 0 : 30000);
      const promoCode = input.promoCode === 'QUANGHUY10' ? input.promoCode : null;
      const discount = promoCode ? Math.round(subtotal * 0.1) : 0;
      sequence += 1;
      const order = {
        code: `DI${String(sequence).padStart(8, '0')}`,
        items, delivery: input.delivery, payment: input.payment, promoCode,
        subtotal, shippingFee, discount, total: subtotal + shippingFee - discount,
        customer: { ...input.customer }, createdAt: new Date().toISOString(),
      };
      orders.push({ id: sequence, ...order, status: 'new' });
      return order;
    },
  };
  return { catalogRepository, orderRepository, adminRepository, postsRepository: adminRepository };
};

module.exports = { createMemoryRepositories };
