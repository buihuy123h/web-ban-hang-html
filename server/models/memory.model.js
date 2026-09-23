'use strict';

/* MODEL nhớ trong RAM — dựng từ data/products.json; dùng cho test và demo khi
 * không cần SQL Server. Tách từ lib/memory-repositories.js khi chuẩn hoá cấu
 * trúc MVC; logic giữ nguyên 100%, hành vi mô phỏng sát model SQL
 * (lọc/tìm/sắp xếp, tính phí ship, mã giảm giá QUANGHUY10). */

const createMemoryRepositories = ({ categories = [], products = [] } = {}) => {
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
      return {
        code: `DI${String(sequence).padStart(8, '0')}`,
        items, delivery: input.delivery, payment: input.payment, promoCode,
        subtotal, shippingFee, discount, total: subtotal + shippingFee - discount,
        customer: { ...input.customer }, createdAt: new Date().toISOString(),
      };
    },
  };
  return { catalogRepository, orderRepository };
};

module.exports = { createMemoryRepositories };
