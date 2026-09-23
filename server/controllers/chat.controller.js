'use strict';

/* CONTROLLER — POST /api/chat
 * Toàn bộ logic RAG + validate + rate limit riêng nằm ở lib/chat.js (thư viện AI,
 * đọc XKIRO_* ngay khi load). Controller chỉ cung cấp nguồn sản phẩm từ model. */

const { createChatHandler } = require('../lib/chat');
const { getServices } = require('../models');

const chatHandler = createChatHandler({
  getProducts: async () => {
    const services = getServices();
    if (!services) throw new Error('Database is not ready');
    return services.catalogRepository.listProducts({});
  },
});

module.exports = { chatHandler };
