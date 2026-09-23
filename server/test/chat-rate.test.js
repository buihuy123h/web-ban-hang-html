/**
 * Kiểm thử rate limit riêng của POST /api/chat (CHAT_RATE_MAX tin/phút/IP).
 * Tách file riêng vì cần đặt trần thấp (3) — chạy file này trong tiến trình
 * riêng của test runner nên không ảnh hưởng các test khác.
 * Chạy: npm test  (trong thư mục server)
 */
'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { app } = require('../app.js');

let server;
let base;

before(async () => {
  /* Đặt sau khi server load .env để chắc chắn đè giá trị cấu hình máy này. */
  process.env.CHAT_RATE_MAX = '3';
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

const postChat = async (payload) => {
  const res = await fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body, headers: res.headers };
};

test('CHAT_RATE_MAX=3 → 3 tin đầu 200 (fallback), tin thứ 4 → 429 kèm Retry-After', async () => {
  const ask = { messages: [{ role: 'user', content: 'shop con ghe nhua khong' }] };

  for (let i = 1; i <= 3; i += 1) {
    const res = await postChat(ask);
    assert.equal(res.status, 200, `tin thứ ${i} phải 200`);
    assert.equal(res.body.mode, 'fallback');
  }

  const fourth = await postChat(ask);
  assert.equal(fourth.status, 429);
  assert.ok(typeof fourth.body.error === 'string' && fourth.body.error.length >= 1);
  const retryAfter = Number(fourth.headers.get('retry-after'));
  assert.ok(Number.isFinite(retryAfter) && retryAfter >= 1 && retryAfter <= 60, 'Retry-After từ 1-60 giây');
});
