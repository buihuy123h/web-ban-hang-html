/**
 * Kiểm thử tăng cường bảo mật (task 2026-09-23 — xem docs/tasks/2026-09-23-toi-uu-he-thong-va-bao-mat.md):
 * ẩn x-powered-by · CSP/COOP/HSTS · CORS whitelist · body >100KB → 413 · Brotli/Gzip cho JSON.
 * Tệp chạy trong tiến trình riêng của test runner nên các biến môi trường đặt dưới đây
 * không ảnh hưởng các bộ test khác.
 */
'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { spawn, spawnSync } = require('node:child_process');
const express = require('express');

/* Cấu hình CORS whitelist TRƯỚC khi nạp app để đo được cả 2 hướng: cho phép / không cho phép.
 * (loadEnvFile không đè biến đã có sẵn trong process.env nên giá trị này chắc chắn thắng.) */
process.env.CORS_ORIGIN = 'https://cho-phep.example';

const { app } = require('../app.js');
const { parseTrustProxy } = require('../app.js');
const { parseOrigins } = require('../middleware/cors');
const { createRateLimiter } = require('../middleware/rate-limit');

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

/* Gửi request thô — kiểm soát method + header y như curl. */
const rawReq = (method, reqPath, headers = {}) => new Promise((resolve, reject) => {
  const req = http.request(`${base}${reqPath}`, { method, headers }, (res) => {
    const chunks = [];
    res.on('data', (c) => chunks.push(c));
    res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
  });
  req.on('error', reject);
  req.end();
});

test('Mọi response: ẩn x-powered-by, có CSP strict + COOP; HTTP thường không có HSTS', async () => {
  const res = await rawReq('GET', '/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.headers['x-powered-by'], undefined, 'không được lộ X-Powered-By');
  const csp = res.headers['content-security-policy'] || '';
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /style-src 'self' 'unsafe-inline' https:\/\/fonts\.googleapis\.com/);
  assert.match(csp, /font-src 'self' https:\/\/fonts\.gstatic\.com/);
  assert.match(csp, /frame-src 'self' https:\/\/www\.google\.com https:\/\/maps\.google\.com/);
  assert.doesNotMatch(csp, /unsafe-eval/);
  assert.equal(res.headers['cross-origin-opener-policy'], 'same-origin');
  assert.equal(res.headers['x-content-type-options'], 'nosniff');
  assert.equal(res.headers['x-frame-options'], 'DENY');
  assert.equal(res.headers['strict-transport-security'], undefined, 'HTTP thường không gắn HSTS');
});

test('Request ID hợp lệ được giữ; giá trị độc hại/dài bị thay bằng UUID an toàn', async () => {
  const accepted = await rawReq('GET', '/api/health', { 'x-request-id': 'checkout_42:a.b-c' });
  assert.equal(accepted.headers['x-request-id'], 'checkout_42:a.b-c');

  const rejected = await rawReq('GET', '/api/health', { 'x-request-id': 'x'.repeat(65) });
  assert.match(String(rejected.headers['x-request-id']), /^[0-9a-f-]{36}$/i);
  assert.notEqual(rejected.headers['x-request-id'], 'x'.repeat(65));
});

test('Config proxy và CORS sai fail-fast', () => {
  for (const value of ['true', '-1', '11', 'all', '127.0.0.1']) {
    assert.throws(() => parseTrustProxy(value), /TRUST_PROXY/);
  }
  assert.equal(parseTrustProxy('1'), 1);
  assert.equal(parseTrustProxy('loopback'), 'loopback');

  const previous = process.env.CORS_ORIGIN;
  const previousNodeEnv = process.env.NODE_ENV;
  try {
    process.env.CORS_ORIGIN = 'https://example.com/path';
    assert.throws(parseOrigins, /CORS_ORIGIN/);
    process.env.CORS_ORIGIN = 'https://user:pass@example.com';
    assert.throws(parseOrigins, /CORS_ORIGIN/);
    process.env.NODE_ENV = 'production';
    process.env.CORS_ORIGIN = '*';
    assert.throws(parseOrigins, /production/);
  } finally {
    if (previous == null) delete process.env.CORS_ORIGIN;
    else process.env.CORS_ORIGIN = previous;
    if (previousNodeEnv == null) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});

test('Entrypoint fail-fast sạch cho CORS, proxy và chat rate sai', () => {
  const cases = [
    [{ CORS_ORIGIN: '*' }, /CORS_ORIGIN/],
    [{ TRUST_PROXY: 'all' }, /TRUST_PROXY/],
    [{ CHAT_RATE_MAX: 'x' }, /CHAT_RATE_MAX/],
  ];
  for (const [overrides, expected] of cases) {
    const childEnv = {
      ...process.env,
      NODE_ENV: 'production', CI: 'false', PORT: '0',
      CORS_ORIGIN: 'https://shop.example', TRUST_PROXY: '0', CHAT_RATE_MAX: '12',
      DB_AUTH_MODE: 'invalid-after-config-check',
      ...overrides,
    };
    delete childEnv.npm_lifecycle_event;
    const result = spawnSync(process.execPath, ['index.js'], {
      cwd: path.resolve(__dirname, '..'), encoding: 'utf8', timeout: 5000, env: childEnv,
    });
    const output = `${result.stdout || ''}${result.stderr || ''}`;
    assert.equal(result.status, 1, output);
    assert.match(output, expected);
    assert.doesNotMatch(output, /node_modules|\n\s+at\s/);
  }
});

test('Production chỉ gửi HSTS khi HTTPS đi qua proxy đã tin cậy', async () => {
  const script = `
    process.env.NODE_ENV = 'production';
    process.env.TRUST_PROXY = '1';
    process.env.CORS_ORIGIN = 'https://shop.example';
    const { startServer } = require('./app');
    const http = require('node:http');
    const catalogRepository = { listCategories: async()=>[], listProducts: async()=>[], getProduct: async()=>null };
    const orderRepository = { createOrder: async()=>({}) };
    (async () => {
      const server = await startServer(0, { catalogRepository, orderRepository, isReady: () => true });
      const base = 'http://127.0.0.1:' + server.address().port;
      const getHeaders = (headers = {}) => new Promise((resolve, reject) => {
        http.get(base + '/api/health', { headers }, (response) => {
          response.resume();
          response.on('end', () => resolve(response.headers));
        }).on('error', reject);
      });
      const httpHeaders = await getHeaders();
      const httpsHeaders = await getHeaders({ 'x-forwarded-proto': 'https' });
      console.log('QA_RESULT=' + JSON.stringify({
        http: httpHeaders['strict-transport-security'] || null,
        https: httpsHeaders['strict-transport-security'] || null,
      }));
      await new Promise((resolve) => server.close(resolve));
    })().catch((error) => { console.error('QA_CHILD=' + error.name); process.exit(2); });
  `;
  const result = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['-e', script], { cwd: path.resolve(__dirname, '..'), windowsHide: true });
    const chunks = [];
    child.stdout.on('data', (chunk) => chunks.push(chunk));
    child.stderr.on('data', (chunk) => chunks.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, output: Buffer.concat(chunks).toString('utf8') }));
  });
  assert.equal(result.code, 0, result.output);
  const match = result.output.match(/QA_RESULT=(\{[^\r\n]+\})/);
  assert.ok(match, result.output);
  const headers = JSON.parse(match[1]);
  assert.equal(headers.http, null);
  assert.match(headers.https, /^max-age=31536000; includeSubDomains$/);
});

test('Sau proxy HTTPS (x-forwarded-proto: https) → có Strict-Transport-Security', async () => {
  const res = await rawReq('GET', '/api/health', { 'x-forwarded-proto': 'https' });
  assert.equal(res.status, 200);
  assert.match(res.headers['strict-transport-security'], /^max-age=\d+/);
});

test('CORS: origin trong whitelist được echo + Vary; origin lạ không có ACAO', async () => {
  const allowed = await rawReq('GET', '/api/health', { origin: 'https://cho-phep.example' });
  assert.equal(allowed.headers['access-control-allow-origin'], 'https://cho-phep.example');
  assert.ok(String(allowed.headers.vary || '').includes('Origin'));

  const denied = await rawReq('GET', '/api/health', { origin: 'https://trang-lua-dao.example' });
  assert.equal(denied.status, 200); // Server vẫn xử lý — trình duyệt mới là nơi chặn đọc.
  assert.equal(denied.headers['access-control-allow-origin'], undefined);

  // Preflight (OPTIONS): cho phép → 204 kèm ACAO; lạ → 204 KHÔNG kèm ACAO (browser tự chặn).
  const preOk = await rawReq('OPTIONS', '/api/products', {
    origin: 'https://cho-phep.example',
    'access-control-request-method': 'POST',
  });
  assert.equal(preOk.status, 204);
  assert.equal(preOk.headers['access-control-allow-origin'], 'https://cho-phep.example');
  assert.match(String(preOk.headers['access-control-allow-methods'] || ''), /POST/);

  const preDenied = await rawReq('OPTIONS', '/api/products', {
    origin: 'https://trang-lua-dao.example',
    'access-control-request-method': 'POST',
  });
  assert.equal(preDenied.status, 204);
  assert.equal(preDenied.headers['access-control-allow-origin'], undefined);

  // Không có Origin header (curl / server-to-server) → vẫn phục vụ bình thường.
  const noOrigin = await rawReq('GET', '/api/health');
  assert.equal(noOrigin.status, 200);
});

test('POST body JSON > 100KB → 413 với thông báo tiếng Việt (không 500)', async () => {
  const big = { customer: { name: 'x'.repeat(200 * 1024), phone: '0901234567', address: 'a'.repeat(50) } };
  const res = await fetch(`${base}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(big),
  });
  assert.equal(res.status, 413);
  const body = await res.json();
  assert.ok(body.error, 'phải có message lỗi JSON');
});

test('JSON hỏng → 400/no-store và không lộ stack', async () => {
  const body = '{"customer":';
  const res = await new Promise((resolve, reject) => {
    const req = http.request(`${base}/api/orders`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) },
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, text: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.end(body);
  });
  assert.equal(res.status, 400);
  assert.match(String(res.headers['cache-control']), /no-store/);
  assert.doesNotMatch(res.text, /SyntaxError|node_modules|at\s+\S+/);
});

test('Rate limiter chặn trước controller, có Retry-After và giữ Map có giới hạn', async () => {
  const mini = express();
  let controllerCalls = 0;
  process.env.QA_RATE_MAX = '1';
  const limiter = createRateLimiter({
    maxEnv: 'QA_RATE_MAX', windowEnv: 'QA_RATE_WINDOW_MS', maxBucketsEnv: 'QA_RATE_BUCKETS_MAX',
    defaultMax: 1, defaultWindowMs: 60_000, defaultMaxBuckets: 100,
  });
  mini.post('/orders', limiter, (_req, res) => { controllerCalls += 1; res.sendStatus(204); });
  const miniServer = await new Promise((resolve) => {
    const listener = mini.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const url = `http://127.0.0.1:${miniServer.address().port}/orders`;
  try {
    assert.equal((await fetch(url, { method: 'POST' })).status, 204);
    const blocked = await fetch(url, { method: 'POST' });
    assert.equal(blocked.status, 429);
    assert.ok(Number(blocked.headers.get('retry-after')) >= 1);
    assert.match(String(blocked.headers.get('cache-control')), /no-store/);
    assert.equal(controllerCalls, 1);
    assert.ok(limiter.buckets.size <= 100);
  } finally {
    delete process.env.QA_RATE_MAX;
    limiter.close();
    await new Promise((resolve) => miniServer.close(resolve));
  }
});

test('Fatal handler thoát mã 1, sanitize log và không đăng ký listener trùng', async () => {
  const entrySource = fs.readFileSync(path.resolve(__dirname, '..', 'index.js'), 'utf8');
  assert.equal((entrySource.match(/process\.on\('unhandledRejection'/g) || []).length, 1,
    'entrypoint chỉ được đăng ký một listener unhandledRejection');
  assert.equal((entrySource.match(/process\.on\('uncaughtException'/g) || []).length, 1,
    'entrypoint chỉ được đăng ký một listener uncaughtException');
  const marker = 'SUPER_SECRET_FATAL_VALUE';
  const script = `
    process.env.NODE_ENV = 'test';
    const { startServer } = require('./app');
    const { registerGracefulShutdown } = require('./index');
    const repo = { listCategories: async()=>[], listProducts: async()=>[], getProduct: async()=>null };
    const orderRepository = { createOrder: async()=>({}) };
    (async () => {
      await startServer(0, { catalogRepository: repo, orderRepository, isReady: () => true });
      registerGracefulShutdown();
      Promise.reject(Object.assign(new Error('${marker}'), { code: 'ERR_FATAL_TEST' }));
    })();
  `;
  const result = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['-e', script], { cwd: path.resolve(__dirname, '..'), windowsHide: true });
    const stdout = [];
    const stderr = [];
    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, output: Buffer.concat([...stdout, ...stderr]).toString('utf8') }));
  });
  assert.equal(result.code, 1);
  assert.match(result.output, /kind=unhandledRejection code=ERR_FATAL_TEST/);
  assert.doesNotMatch(result.output, new RegExp(marker));
  assert.equal((result.output.match(/kind=unhandledRejection/g) || []).length, 1);
});

test('JSON lớn: Brotli khi client hỗ trợ (gọn hơn bản gốc), gzip khi client chỉ nhận gzip', async () => {
  const br = await rawReq('GET', '/api/products', { 'accept-encoding': 'gzip, deflate, br' });
  assert.equal(br.headers['content-encoding'], 'br');
  assert.ok(String(br.headers.vary || '').toLowerCase().includes('accept-encoding'));
  const decoded = JSON.parse(zlib.brotliDecompressSync(br.body).toString('utf8'));
  assert.ok(Array.isArray(decoded) && decoded.length > 0, 'giải nén brotli ra đúng JSON');

  const gz = await rawReq('GET', '/api/products', { 'accept-encoding': 'gzip' });
  assert.equal(gz.headers['content-encoding'], 'gzip');
  const decodedGz = JSON.parse(zlib.gunzipSync(gz.body).toString('utf8'));
  assert.equal(decodedGz.length, decoded.length);

  const plain = await rawReq('GET', '/api/products', { 'accept-encoding': 'identity' });
  assert.equal(plain.headers['content-encoding'], undefined);
  assert.ok(br.body.length < plain.body.length, 'bản nén phải nhỏ hơn bản gốc');
});

test('ETag/304 vẫn hoạt động với JSON nén (If-None-Match khớp → 304)', async () => {
  const first = await rawReq('GET', '/api/products', { 'accept-encoding': 'gzip, br' });
  const etag = first.headers.etag;
  assert.ok(etag, 'JSON lớn phải có ETag');
  const again = await rawReq('GET', '/api/products', { 'accept-encoding': 'gzip, br', 'if-none-match': etag });
  assert.equal(again.status, 304);
});

test('HTML (nếu đã build client) cũng mang CSP', async () => {
  const distIndex = path.resolve(__dirname, '..', '..', 'client', 'dist', 'index.html');
  if (!fs.existsSync(distIndex)) return; // Chưa build client → bỏ qua.
  const res = await rawReq('GET', '/');
  assert.equal(res.status, 200);
  assert.match(String(res.headers['content-security-policy'] || ''), /default-src 'self'/);
});
