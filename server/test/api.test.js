/**
 * Kiểm thử REST API — dùng test runner có sẵn của Node (không cần cài thêm gì).
 * Chạy: npm test  (trong thư mục server)
 */
'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { app, products } = require('../server.js');

let server;
let base;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

const get = async (path) => {
  const res = await fetch(`${base}${path}`);
  const body = await res.json().catch(() => null);
  return { status: res.status, body, headers: res.headers };
};

const post = async (path, payload, rawBody) => {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: rawBody !== undefined ? rawBody : JSON.stringify(payload),
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
};

const validCustomer = {
  name: 'Nguyễn Test',
  phone: '0901234567',
  address: '12 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh',
  note: '',
};

test('GET /api/health → ok kèm version', async () => {
  const res = await get('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.match(res.body.version, /^\d+\.\d+\.\d+$/);
  assert.equal(typeof res.body.uptime, 'number');
});

test('GET /api/categories → đủ danh mục, mỗi mục có key + label', async () => {
  const res = await get('/api/categories');
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body));
  assert.ok(res.body.length >= 3);
  for (const category of res.body) {
    assert.ok(category.key && category.label);
  }
});

test('GET /api/products → toàn bộ sản phẩm, đủ trường', async () => {
  const res = await get('/api/products');
  assert.equal(res.status, 200);
  assert.equal(res.body.length, products.length);
  for (const item of res.body) {
    for (const key of ['id', 'name', 'price', 'rating', 'sold', 'category']) {
      assert.ok(item[key] !== undefined, `thiếu trường ${key}`);
    }
  }
});

test('GET /api/products?cat= → lọc đúng danh mục', async () => {
  const cat = products[0].category;
  const res = await get(`/api/products?cat=${encodeURIComponent(cat)}`);
  assert.equal(res.status, 200);
  assert.ok(res.body.length > 0);
  assert.ok(res.body.every((p) => p.category === cat));
});

test('GET /api/products?q= → tìm theo tên', async () => {
  const needle = products[0].name.split(' ')[0];
  const res = await get(`/api/products?q=${encodeURIComponent(needle)}`);
  assert.equal(res.status, 200);
  assert.ok(res.body.every((p) => p.name.toLowerCase().includes(needle.toLowerCase())));
});

test('GET /api/products?sort=price-asc → giá tăng dần', async () => {
  const res = await get('/api/products?sort=price-asc');
  assert.equal(res.status, 200);
  const prices = res.body.map((p) => p.price);
  assert.deepEqual(prices, [...prices].sort((a, b) => a - b));
});

test('GET /api/products/:id → chi tiết + related; id sai → 404', async () => {
  const ok = await get(`/api/products/${products[0].id}`);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.product.id, products[0].id);
  assert.ok(Array.isArray(ok.body.related));

  const missing = await get('/api/products/999999');
  assert.equal(missing.status, 404);
  assert.ok(missing.body.error);
});

test('POST /api/orders → 201, tính đúng tiền theo giá server + mã đơn DI + 8 số', async () => {
  const [first, second] = products;
  const res = await post('/api/orders', {
    items: [{ id: first.id, qty: 2 }, { id: second.id, qty: 1 }],
    delivery: 'standard',
    payment: 'cod',
    promoCode: 'QUANGHUY10',
    customer: validCustomer,
  });
  assert.equal(res.status, 201);

  const order = res.body.order;
  const subtotal = order.items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const discount = Math.round(subtotal * 0.1);
  const shipping = subtotal >= 500000 ? 0 : 30000;
  assert.equal(order.subtotal, subtotal);
  assert.equal(order.discount, discount);
  assert.equal(order.shippingFee, shipping);
  assert.equal(order.total, subtotal + shipping - discount);
  assert.match(order.code, /^DI\d{8}$/);
  assert.equal(order.items[0].price, first.price);
});

test('POST /api/orders → gộp dòng trùng id', async () => {
  const first = products[0];
  const res = await post('/api/orders', {
    items: [{ id: first.id, qty: 1 }, { id: first.id, qty: 2 }],
    delivery: 'standard',
    payment: 'cod',
    customer: validCustomer,
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.order.items.length, 1);
  assert.equal(res.body.order.items[0].qty, 3);
});

test('POST /api/orders → thiếu dữ liệu thì 400 kèm lỗi từng trường', async () => {
  const res = await post('/api/orders', {
    items: [],
    customer: { name: 'A', phone: '123', address: 'ngắn' },
    delivery: 'rocket',
    payment: 'bitcoin',
  });
  assert.equal(res.status, 400);
  assert.ok(res.body.fields['customer.name']);
  assert.ok(res.body.fields['customer.phone']);
  assert.ok(res.body.fields['customer.address']);
  assert.ok(res.body.fields.delivery);
  assert.ok(res.body.fields.payment);
});

test('POST /api/orders → sản phẩm không tồn tại thì 400', async () => {
  const res = await post('/api/orders', {
    items: [{ id: 999999, qty: 1 }],
    delivery: 'standard',
    payment: 'cod',
    customer: validCustomer,
  });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /không tồn tại/);
});

test('POST /api/orders → số lượng 0 thì 400', async () => {
  const res = await post('/api/orders', {
    items: [{ id: products[0].id, qty: 0 }],
    delivery: 'standard',
    payment: 'cod',
    customer: validCustomer,
  });
  assert.equal(res.status, 400);
});

test('POST /api/orders → JSON hỏng thì 400', async () => {
  const res = await post('/api/orders', null, '{khong-phai-json');
  assert.equal(res.status, 400);
});

test('API không tồn tại → 404 JSON', async () => {
  const res = await get('/api/khong-ton-tai');
  assert.equal(res.status, 404);
  assert.ok(res.body.error);
});

test('Có security headers + rate limit headers', async () => {
  const res = await get('/api/health');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-frame-options'), 'DENY');
  assert.ok(res.headers.get('x-ratelimit-limit'));
  assert.ok(res.headers.get('x-ratelimit-remaining'));
});

test('Phản hồi JSON lớn được nén gzip', async () => {
  await new Promise((resolve, reject) => {
    http.get(`${base}/api/products`, { headers: { 'Accept-Encoding': 'gzip' } }, (res) => {
      try {
        assert.equal(res.headers['content-encoding'], 'gzip');
        res.resume();
        res.on('end', resolve);
      } catch (err) {
        reject(err);
      }
    }).on('error', reject);
  });
});

