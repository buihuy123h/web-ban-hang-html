'use strict';

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { app, configureServices } = require('../app');
const { createMemoryRepositories } = require('../models/memory.model');

let server;
let base;
let repositories;
const product = { id: 901, name: 'Sản phẩm test', category: 'ban-ghe', price: 100000, description: 'Mô tả test', rating: 0, sold: 0, images: [], specs: [] };

const configure = () => {
  repositories = createMemoryRepositories({ products: [{ ...product }], categories: [], posts: [] });
  configureServices({
    ...repositories,
    isReady: () => true,
  });
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

test('admin delete chặn sản phẩm đã xuất hiện trong đơn qua HTTP in-process', async () => {
  await repositories.orderRepository.createOrder({
    items: [{ id: product.id, qty: 1 }], delivery: 'standard', payment: 'cod',
    customer: { name: 'QA', phone: '0900000000', address: 'Test', note: '' },
  });
  const cookie = await login();
  const deleted = await request(`/api/admin/products/${product.id}`, { method: 'DELETE', headers: { Cookie: cookie } });
  assert.equal(deleted.response.status, 409);
  assert.deepEqual(deleted.body, { error: 'Không thể xóa sản phẩm đã có trong đơn hàng.' });
  assert.ok(await repositories.catalogRepository.getProductById(product.id));
});

test('admin publish bài viết được public posts đọc, đổi về draft thì bị ẩn', async () => {
  const cookie = await login();
  const created = await request('/api/admin/posts', json('POST', {
    title: 'Bài QA', slug: 'bai-qa', excerpt: 'Tóm tắt', content: 'Nội dung QA', status: 'published',
  }, cookie));
  assert.equal(created.response.status, 201);

  const visible = await request('/api/posts/bai-qa');
  assert.equal(visible.response.status, 200);
  assert.deepEqual(visible.body.post, {
    id: created.body.post.post_id,
    title: 'Bài QA', slug: 'bai-qa', excerpt: 'Tóm tắt', content: 'Nội dung QA', image: null,
    createdAt: created.body.post.created_at, updatedAt: created.body.post.updated_at,
  });

  const updated = await request(`/api/admin/posts/${created.body.post.post_id}`, json('PUT', {
    title: 'Bài QA', slug: 'bai-qa', excerpt: 'Tóm tắt', content: 'Nội dung QA', status: 'draft',
  }, cookie));
  assert.equal(updated.response.status, 200);
  const hidden = await request('/api/posts/bai-qa');
  assert.equal(hidden.response.status, 404);
  assert.deepEqual(hidden.body, { error: 'Không tìm thấy bài viết.' });
});

test('admin endpoint không có cookie trả 401 còn public posts không yêu cầu cookie', async () => {
  const admin = await request('/api/admin/products');
  assert.equal(admin.response.status, 401);
  const publicList = await request('/api/posts');
  assert.equal(publicList.response.status, 200);
  assert.deepEqual(publicList.body, { posts: [] });
});
