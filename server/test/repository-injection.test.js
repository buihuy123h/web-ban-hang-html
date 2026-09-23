'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { app, configureServices } = require('../app');

let server;
let base;
before(async () => {
  await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => new Promise((resolve) => server.close(resolve)));

test('catalog thay đổi giữa hai request mà không reload module', async () => {
  let name = 'Tên trước';
  const product = () => ({
    id: 1, name, category: 'test', categoryLabel: 'Test', price: 1, oldPrice: null,
    rating: 5, sold: 0, badge: null, description: '', image: null, images: [], specs: [],
  });
  configureServices({
    isReady: () => true,
    catalogRepository: {
      listCategories: async () => [], listProducts: async () => [product()],
      getProductById: async () => product(), listRelatedProducts: async () => [],
    },
    orderRepository: { createOrder: async () => { throw new Error('not used'); } },
  });
  const first = await (await fetch(`${base}/api/products`)).json();
  name = 'Tên sửa trong DB';
  const second = await (await fetch(`${base}/api/products`)).json();
  assert.equal(first[0].name, 'Tên trước');
  assert.equal(second[0].name, 'Tên sửa trong DB');
});

test('health 503 và route DB lỗi 503/no-store không lộ chi tiết', async () => {
  configureServices({
    isReady: () => false,
    catalogRepository: {
      listCategories: async () => { throw new Error('Data Source=secret;password=secret'); },
      listProducts: async () => { throw new Error('secret'); },
      getProductById: async () => null, listRelatedProducts: async () => [],
    },
    orderRepository: { createOrder: async () => { throw new Error('secret'); } },
  });
  const health = await fetch(`${base}/api/health`);
  const healthBody = await health.json();
  assert.equal(health.status, 503);
  assert.equal(healthBody.database, 'disconnected');
  assert.doesNotMatch(JSON.stringify(healthBody), /secret|Data Source/i);

  const catalog = await fetch(`${base}/api/categories`);
  const body = await catalog.json();
  assert.equal(catalog.status, 503);
  assert.equal(catalog.headers.get('cache-control'), 'no-store');
  assert.doesNotMatch(JSON.stringify(body), /secret|Data Source/i);
});
