/**
 * Kiểm thử POST /api/chat — chạy ở chế độ fallback (môi trường test không có
 * key, KHÔNG gọi mạng ngoài; chỉ kiểm hợp đồng API + truy xuất dữ liệu thật).
 * Chạy: npm test  (trong thư mục server)
 */
'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { app, products } = require('../app.js');

let server;
let base;

before(async () => {
  /* Nới trần chat để file này gửi liên tiếp nhiều case (đặt sau khi server
   * load .env để chắc chắn đè giá trị nếu máy có cấu hình riêng). */
  process.env.CHAT_RATE_MAX = '50';
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

const postChat = async (payload, rawBody) => {
  const res = await fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: rawBody !== undefined ? rawBody : JSON.stringify(payload),
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body, headers: res.headers };
};

const ask = (content) => ({ messages: [{ role: 'user', content }] });

/* ===== Hợp đồng response + chế độ fallback (AC: web không cần key vẫn chạy) ===== */

test('POST /api/chat hợp lệ → 200, mode "fallback" (không key), đúng hình dạng response', async () => {
  const res = await postChat(ask('Shop còn ghế nhựa cho quán cà phê không?'));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.equal(typeof res.body.reply, 'string');
  assert.ok(res.body.reply.length >= 1);
  assert.equal(res.body.mode, 'fallback');
  assert.ok(Array.isArray(res.body.products));
  assert.ok(res.body.products.length <= 4);
  for (const chip of res.body.products) {
    assert.ok(chip.id !== undefined, 'chip phải có id');
    assert.ok(typeof chip.name === 'string' && chip.name.length >= 1);
    assert.ok(typeof chip.price === 'number');
    const real = products.find((p) => p.id === chip.id);
    assert.ok(real, 'chip phải tồn tại trong products.json thật');
    assert.equal(real.name, chip.name);
    assert.equal(real.price, chip.price);
  }
});

test('Hỏi KHÔNG DẤU "ghe nhua" → vẫn trả được món ghế nhựa thật', async () => {
  const res = await postChat(ask('con ghe nhua cho quan khong con khong'));
  assert.equal(res.status, 200);
  assert.ok(res.body.products.length >= 1, 'phải gợi ý ít nhất 1 món');
  const matchedNames = res.body.products
    .map((chip) => products.find((p) => p.id === chip.id))
    .filter(Boolean)
    .map((p) => p.name.toLowerCase());
  assert.ok(
    matchedNames.some((name) => name.includes('ghế nhựa')),
    'phải có món tên chứa "ghế nhựa"',
  );
});

test('Hỏi phí ship → fallback trả đúng chính sách 30.000₫/45.000₫/freeship 500.000₫', async () => {
  const res = await postChat(ask('shop ship ve tan go vap phi ship bao nhieu tien'));
  assert.equal(res.status, 200);
  const { reply } = res.body;
  assert.ok(reply.includes('30.000'), 'phải nêu phí giao tiêu chuẩn 30.000₫');
  assert.ok(reply.includes('45.000'), 'phải nêu phí giao nhanh 45.000₫');
  assert.ok(reply.includes('500.000'), 'phải nêu freeship từ 500.000₫');
});

test('Hỏi địa chỉ → fallback có kho 707 Tân Sơn', async () => {
  const res = await postChat(ask('dia chi cua shop o dau the a'));
  assert.equal(res.status, 200);
  assert.ok(res.body.reply.includes('707 Tân Sơn'));
});

test('Câu hỏi ngoài dữ liệu shop → vẫn 200 + reply thân thiện (web không bao giờ vỡ)', async () => {
  const res = await postChat(ask('thoi tiet hom nay the nao'));
  assert.equal(res.status, 200);
  assert.equal(res.body.mode, 'fallback');
  assert.ok(typeof res.body.reply === 'string' && res.body.reply.length >= 1);
});

/* ===== Validate 400 theo hợp đồng ===== */

test('Thiếu messages → 400 kèm problems', async () => {
  const res = await postChat({});
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'Hội thoại chưa hợp lệ.');
  assert.ok(Array.isArray(res.body.problems) && res.body.problems.length >= 1);
});

test('JSON sai cú pháp → 400', async () => {
  const res = await postChat(null, '{ khong hop le');
  assert.equal(res.status, 400);
});

test('Role lạ / tin cuối là assistant / quá 20 tin / nội dung quá 1000 ký tự → 400', async () => {
  const badRole = await postChat({ messages: [{ role: 'admin', content: 'cho xem ghe' }] });
  assert.equal(badRole.status, 400);

  const lastIsAssistant = await postChat({
    messages: [
      { role: 'user', content: 'xin chao' },
      { role: 'assistant', content: 'chao ban' },
    ],
  });
  assert.equal(lastIsAssistant.status, 400);

  const tooManyMessages = await postChat({
    messages: Array.from({ length: 21 }, (_, i) => ({
      role: i % 2 ? 'assistant' : 'user',
      content: `tin thu ${i}`,
    })),
  });
  assert.equal(tooManyMessages.status, 400);

  const tooLongContent = await postChat({ messages: [{ role: 'user', content: 'a'.repeat(1001) }] });
  assert.equal(tooLongContent.status, 400);
});
