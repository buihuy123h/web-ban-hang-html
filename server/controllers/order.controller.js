'use strict';

/* CONTROLLER — POST /api/orders
 * - Validate dữ liệu khách + gộp dòng trùng sản phẩm.
 * - Giá luôn lấy từ dữ liệu server (model), không tin giá client gửi lên. */

const { getServices } = require('../models');
const { databaseUnavailable } = require('./helpers');

const SHIPPING_FEES = { standard: 30000, express: 45000 };
const MAX_ITEMS_PER_ORDER = 50;

const validateOrder = (body) => {
  const fields = {};
  const customer = body.customer && typeof body.customer === 'object' ? body.customer : {};
  const { items } = body;

  if (!Array.isArray(items) || items.length === 0) fields.items = 'Giỏ hàng trống.';
  else if (items.length > MAX_ITEMS_PER_ORDER) fields.items = `Tối đa ${MAX_ITEMS_PER_ORDER} món mỗi đơn.`;
  if (String(customer.name || '').trim().length < 2) fields['customer.name'] = 'Nhập họ tên người nhận.';
  if (!/^0\d{9}$/.test(String(customer.phone || '').trim())) fields['customer.phone'] = 'Số điện thoại cần 10 số và bắt đầu bằng 0.';
  if (String(customer.address || '').trim().length < 10) fields['customer.address'] = 'Nhập địa chỉ giao hàng đầy đủ hơn.';
  if (!SHIPPING_FEES[body.delivery]) fields.delivery = 'Chọn cách giao hàng hợp lệ.';
  if (!['cod', 'transfer'].includes(body.payment)) fields.payment = 'Chọn cách thanh toán hợp lệ.';

  return fields;
};

const createOrder = async (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  const body = req.body || {};
  const fields = validateOrder(body);
  if (Object.keys(fields).length) {
    return res.status(400).json({ error: 'Dữ liệu đơn hàng chưa hợp lệ.', fields });
  }

  // Gộp các dòng trùng sản phẩm. Giá luôn lấy từ dữ liệu server, không tin giá client gửi lên.
  const merged = new Map();
  for (const raw of body.items) {
    const id = Number(raw && raw.id);
    const qty = Math.floor(Number(raw && raw.qty));
    if (!Number.isFinite(qty) || qty < 1 || qty > 99) {
      return res.status(400).json({ error: `Số lượng không hợp lệ (id: ${id}).` });
    }
    merged.set(id, (merged.get(id) || 0) + qty);
  }

  for (const [id, qty] of merged) {
    if (!Number.isInteger(id) || id <= 0 || qty > 99) {
      return res.status(400).json({ error: `Số lượng không hợp lệ (id: ${id}).` });
    }
  }
  try {
    const services = getServices();
    if (!services) return databaseUnavailable(res);
    const order = await services.orderRepository.createOrder({
      items: [...merged].map(([id, qty]) => ({ id, qty })),
      delivery: body.delivery,
      payment: body.payment,
      promoCode: String(body.promoCode || '').trim().toUpperCase() || null,
      customer: {
        name: String(body.customer.name).trim().slice(0, 80),
        phone: String(body.customer.phone).trim(),
        address: String(body.customer.address).trim().slice(0, 300),
        note: String(body.customer.note || '').trim().slice(0, 500),
      },
    });
    return res.status(201).json({ order });
  } catch (error) {
    if (error.isBusinessError || error.status === 400) return res.status(400).json({ error: error.message });
    error.isDatabaseError = true;
    return next(error);
  }
};

module.exports = { createOrder };
