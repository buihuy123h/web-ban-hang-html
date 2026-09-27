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
  let store = { store_id: 1, name: 'Đồ Cũ Quang Huy', phone: '', address: '', description: '', opening_hours: '', facebook_url: '' };
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
