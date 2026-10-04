'use strict';

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
process.env.ADMIN_LOGIN_RATE_MAX = '100'; // đặt trước khi load app để limiter đọc đúng giới hạn
const { app, configureServices } = require('../app');
const { createMemoryRepositories } = require('../models/memory.model');

let server;
let base;
let repositories;
const product = { id: 901, name: 'Sản phẩm test', category: 'ban-ghe', price: 100000, costPrice: 40000, description: 'Mô tả test', rating: 0, sold: 0, images: [], specs: [] };

const configure = () => {
  repositories = createMemoryRepositories({ products: [{ ...product }], categories: [], posts: [] });
  configureServices({ ...repositories, isReady: () => true });
};

before(async () => {
  process.env.ADMIN_USERNAME = 'qa-admin';
  process.env.ADMIN_PASSWORD = 'qa-password';
  configure();
  await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(configure);
after(async () => new Promise((resolve) => server.close(resolve)));

const request = async (path, options = {}) => {
  const response = await fetch(`${base}${path}`, options);
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { response, body };
};
const json = (method, body, cookie) => ({ method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body) });

const login = async () => {
  const result = await request('/api/admin/login', json('POST', { username: 'qa-admin', password: 'qa-password' }));
  assert.equal(result.response.status, 200);
  return result.response.headers.get('set-cookie').split(';', 1)[0];
};

const createOrder = async (overrides = {}) => {
  const result = await request('/api/orders', json('POST', {
    items: [{ id: product.id, qty: 2 }], delivery: 'standard', payment: 'cod',
    customer: { name: 'Nguyễn Văn A', phone: '0900000001', address: '12 Lê Lợi, Hà Nội', note: '' },
    ...overrides,
  }));
  assert.equal(result.response.status, 201);
  return result.body;
};

test('yêu cầu xác thực cho các API admin mới', async () => {
  for (const path of ['/api/admin/customers', '/api/admin/feedback', '/api/admin/reports/profit', '/api/admin/system']) {
    const result = await request(path);
    assert.equal(result.response.status, 401, path);
  }
});

test('khách hàng được tổng hợp từ đơn hàng', async () => {
  await createOrder();
  await createOrder({ customer: { name: 'Trần B', phone: '0900000002', address: '45 Nguyễn Trãi, Hải Phòng', note: '' } });
  const cookie = await login();
  const result = await request('/api/admin/customers', { headers: { Cookie: cookie } });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.customers.length, 2);
  const first = result.body.customers.find((customer) => customer.phone === '0900000001');
  assert.equal(first.name, 'Nguyễn Văn A');
  assert.equal(first.orderCount, 1);
  assert.ok(first.totalSpent > 0);
  assert.ok(first.lastOrderAt);
});

test('phản hồi: danh sách, thêm, đổi trạng thái, xóa', async () => {
  const cookie = await login();
  const created = await request('/api/admin/feedback', json('POST', { customerName: 'Khách A', phone: '0900000003', message: 'Giao hàng nhanh', rating: 5 }, cookie));
  assert.equal(created.response.status, 201);
  assert.equal(created.body.feedback.status, 'new');

  const invalid = await request('/api/admin/feedback', json('POST', { customerName: '', message: 'Thiếu tên' }, cookie));
  assert.equal(invalid.response.status, 400);

  const updated = await request(`/api/admin/feedback/${created.body.feedback.id}/status`, json('PATCH', { status: 'replied' }, cookie));
  assert.equal(updated.response.status, 200);
  assert.equal(updated.body.feedback.status, 'replied');

  const badStatus = await request(`/api/admin/feedback/${created.body.feedback.id}/status`, json('PATCH', { status: 'weird' }, cookie));
  assert.equal(badStatus.response.status, 400);

  const listed = await request('/api/admin/feedback', { headers: { Cookie: cookie } });
  assert.equal(listed.body.feedback.length, 1);

  const removed = await request(`/api/admin/feedback/${created.body.feedback.id}`, { method: 'DELETE', headers: { Cookie: cookie } });
  assert.equal(removed.response.status, 204);
  const after = await request('/api/admin/feedback', { headers: { Cookie: cookie } });
  assert.equal(after.body.feedback.length, 0);
});

test('báo cáo lợi nhuận tính doanh thu, giá vốn, lợi nhuận', async () => {
  await createOrder();
  const cookie = await login();
  const result = await request('/api/admin/reports/profit', { headers: { Cookie: cookie } });
  assert.equal(result.response.status, 200);
  const { totals, monthly, topProducts } = result.body.report;
  // 2 món × 100.000 = 200.000 doanh thu; giá vốn 2 × 40.000 = 80.000; LN 120.000
  assert.equal(totals.revenue, 200000);
  assert.equal(totals.cost, 80000);
  assert.equal(totals.profit, 120000);
  assert.equal(totals.orderCount, 1);
  assert.equal(monthly.length, 1);
  assert.equal(topProducts.length, 1);
  assert.equal(topProducts[0].name, product.name);
});

test('cài đặt hệ thống: đọc và cập nhật', async () => {
  const cookie = await login();
  const initial = await request('/api/admin/system', { headers: { Cookie: cookie } });
  assert.equal(initial.response.status, 200);
  assert.equal(initial.body.settings.shippingFee, 30000);

  const updated = await request('/api/admin/system', json('PUT', { shippingFee: 25000, freeShippingThreshold: 700000, maintenanceMode: true, announcement: 'Bảo trì tối nay' }, cookie));
  assert.equal(updated.response.status, 200);
  assert.equal(updated.body.settings.shippingFee, 25000);
  assert.equal(updated.body.settings.freeShippingThreshold, 700000);
  assert.equal(updated.body.settings.maintenanceMode, true);
  assert.equal(updated.body.settings.announcement, 'Bảo trì tối nay');

  const invalid = await request('/api/admin/system', json('PUT', { shippingFee: -5, freeShippingThreshold: 0 }, cookie));
  assert.equal(invalid.response.status, 400);
});

test('sản phẩm lưu được giá vốn', async () => {
  const cookie = await login();
  const created = await request('/api/admin/products', json('POST', { name: 'Bàn gỗ', category: 'ban-ghe', price: 500000, costPrice: 200000, description: 'Bàn gỗ cũ', rating: 4 }, cookie));
  assert.equal(created.response.status, 201);
  assert.equal(created.body.product.costPrice, 200000);
});

test('login admin bị giới hạn số lần thử (chống brute force)', async () => {
  // Giới hạn 100/phút; sau khi cạn quota (đã tiêu bởi các login trước trong file) → 429
  let last;
  for (let i = 0; i < 105; i += 1) {
    last = await request('/api/admin/login', json('POST', { username: 'qa-admin', password: `sai-${i}` }));
    if (last.response.status === 429) break;
  }
  assert.equal(last.response.status, 429);
  assert.ok(String(last.body.error).includes('quá nhiều lần'));
});

