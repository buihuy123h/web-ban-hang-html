import { request } from './client';

/**
 * Gửi đơn hàng lên backend. Backend chịu trách nhiệm kiểm tra dữ liệu
 * và tính lại toàn bộ tiền bằng giá chuẩn từ server.
 *
 * payload = {
 *   items: [{ id, qty }],
 *   delivery: 'standard' | 'express',
 *   payment: 'cod' | 'transfer',
 *   promoCode: 'INOX10' | '',
 *   customer: { name, phone, address, note },
 * }
 * Trả về { order } với order.code là mã đơn hàng.
 */
export const createOrder = (payload) => request('/orders', {
  method: 'POST',
  body: JSON.stringify(payload),
});
