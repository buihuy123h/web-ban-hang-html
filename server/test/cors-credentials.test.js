'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const allowedOrigin = 'https://docuquanghuy-huy-6c9e.vercel.app';
process.env.NODE_ENV = 'test';
process.env.CORS_ORIGIN = allowedOrigin;

const { app } = require('../app');
const { setSessionCookie, clearSessionCookie } = require('../middleware/admin-auth');

let server;
let base;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => new Promise((resolve) => server.close(resolve)));

const rawRequest = (method, requestPath, headers = {}, body = '') => new Promise((resolve, reject) => {
  const request = http.request(`${base}${requestPath}`, { method, headers }, (response) => {
    const chunks = [];
    response.on('data', (chunk) => chunks.push(chunk));
    response.on('end', () => resolve({
      status: response.statusCode,
      headers: response.headers,
      body: Buffer.concat(chunks),
    }));
  });
  request.on('error', reject);
  request.end(body);
});

test('CORS credentialed echo origin được phép cho GET', async () => {
  for (const requestPath of ['/api/products', '/api/categories']) {
    const response = await rawRequest('GET', requestPath, {
      origin: allowedOrigin,
      'accept-encoding': 'gzip',
    });
    assert.equal(response.status, 200, requestPath);
    assert.equal(response.headers['access-control-allow-origin'], allowedOrigin, requestPath);
    assert.equal(response.headers['access-control-allow-credentials'], 'true', requestPath);
    assert.match(String(response.headers.vary || ''), /(?:^|,\s*)Origin(?:,|$)/, requestPath);
    if (requestPath === '/api/products') {
      assert.match(String(response.headers.vary || ''), /(?:^|,\s*)Accept-Encoding(?:,|$)/, requestPath);
    }
  }
});

test('preflight origin được phép hỗ trợ đầy đủ method API và không có body', async () => {
  const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
  for (const method of methods) {
    const response = await rawRequest('OPTIONS', '/api/admin/products/1', {
      origin: allowedOrigin,
      'access-control-request-method': method,
      'access-control-request-headers': 'content-type, x-request-id',
    });
    assert.equal(response.status, 204, method);
    assert.equal(response.body.length, 0, method);
    assert.equal(response.headers['access-control-allow-origin'], allowedOrigin, method);
    assert.equal(response.headers['access-control-allow-credentials'], 'true', method);
    assert.equal(response.headers['access-control-allow-methods'], 'GET, POST, PUT, PATCH, DELETE, OPTIONS', method);
    assert.equal(response.headers['access-control-allow-headers'], 'Content-Type, X-Request-Id', method);
  }
});

test('origin lạ và request không Origin không nhận header CORS', async () => {
  const denied = await rawRequest('OPTIONS', '/api/admin/products/1', {
    origin: 'https://khong-duoc-phep.example',
    'access-control-request-method': 'DELETE',
  });
  assert.equal(denied.status, 204);
  assert.match(String(denied.headers['cache-control']), /no-store/);
  assert.equal(denied.headers['access-control-allow-origin'], undefined);
  assert.equal(denied.headers['access-control-allow-credentials'], undefined);
  assert.equal(denied.headers['access-control-allow-methods'], undefined);
  assert.equal(denied.headers['access-control-allow-headers'], undefined);

  const deniedApi = await rawRequest('GET', '/api/products', {
    origin: 'https://khong-duoc-phep.example',
  });
  assert.equal(deniedApi.status, 200);
  assert.equal(deniedApi.headers['access-control-allow-origin'], undefined);
  assert.equal(deniedApi.headers['access-control-allow-credentials'], undefined);

  const noOrigin = await rawRequest('GET', '/api/health');
  assert.equal(noOrigin.status, 200);
  assert.equal(noOrigin.headers['access-control-allow-origin'], undefined);
  assert.equal(noOrigin.headers['access-control-allow-credentials'], undefined);
});

test('response lỗi parser vẫn có ACAO và ACAC cho origin được phép', async () => {
  const body = '{"customer":';
  const response = await rawRequest('POST', '/api/orders', {
    origin: allowedOrigin,
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(body),
  }, body);
  assert.equal(response.status, 400);
  assert.equal(response.headers['access-control-allow-origin'], allowedOrigin);
  assert.equal(response.headers['access-control-allow-credentials'], 'true');
});

test('wildcard non-production không kết hợp với credentials', () => {
  const script = `
    process.env.NODE_ENV = 'test';
    process.env.CORS_ORIGIN = '*';
    const cors = require('./middleware/cors');
    const headers = {};
    const req = { method: 'GET', get: (name) => name === 'Origin' ? 'https://bat-ky.example' : undefined };
    const res = {
      vary: (name) => { headers.vary = name; },
      setHeader: (name, value) => { headers[name.toLowerCase()] = value; },
    };
    cors(req, res, () => {});
    console.log('QA_CORS=' + JSON.stringify(headers));
  `;
  const result = spawnSync(process.execPath, ['-e', script], {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8',
    timeout: 5000,
  });
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  assert.equal(result.status, 0, output);
  const match = output.match(/QA_CORS=(\{[^\r\n]+\})/);
  assert.ok(match, output);
  const headers = JSON.parse(match[1]);
  assert.equal(headers['access-control-allow-origin'], '*');
  assert.equal(headers['access-control-allow-credentials'], undefined);
});

test('login, phiên admin và logout production dùng cookie cross-site an toàn', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousUsername = process.env.ADMIN_USERNAME;
  const previousPassword = process.env.ADMIN_PASSWORD;

  try {
    process.env.NODE_ENV = 'production';
    process.env.ADMIN_USERNAME = 'qa-admin';
    process.env.ADMIN_PASSWORD = 'qa-password';
    const loginBody = JSON.stringify({ username: 'qa-admin', password: 'qa-password' });
    const login = await rawRequest('POST', '/api/admin/login', {
      origin: allowedOrigin,
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(loginBody),
    }, loginBody);
    assert.equal(login.status, 200);
    assert.equal(login.headers['access-control-allow-origin'], allowedOrigin);
    assert.equal(login.headers['access-control-allow-credentials'], 'true');
    assert.match(
      String(login.headers['set-cookie']),
      /^qh_admin_session=[^;]+; HttpOnly; SameSite=None; Secure; Path=\/; Max-Age=28800$/,
    );

    const cookie = String(login.headers['set-cookie']).split(';', 1)[0];
    const me = await rawRequest('GET', '/api/admin/me', { origin: allowedOrigin, cookie });
    assert.equal(me.status, 200);
    assert.equal(me.headers['access-control-allow-credentials'], 'true');

    const logout = await rawRequest('POST', '/api/admin/logout', {
      origin: allowedOrigin,
      cookie,
    });
    assert.equal(logout.status, 204);
    assert.equal(
      String(logout.headers['set-cookie']),
      'qh_admin_session=; HttpOnly; SameSite=None; Secure; Path=/; Max-Age=0',
    );
  } finally {
    if (previousNodeEnv == null) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousUsername == null) delete process.env.ADMIN_USERNAME;
    else process.env.ADMIN_USERNAME = previousUsername;
    if (previousPassword == null) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = previousPassword;
  }
});

test('cookie admin local/test vẫn tương thích HTTP', () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const capture = (action) => {
    let value;
    const response = {
      set(name, headerValue) {
        assert.equal(name, 'Set-Cookie');
        value = headerValue;
        return this;
      },
    };
    action(response);
    return value;
  };

  try {
    process.env.NODE_ENV = 'test';
    assert.equal(
      capture((response) => setSessionCookie(response, 'opaque-token')),
      'qh_admin_session=opaque-token; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800',
    );
    assert.equal(
      capture(clearSessionCookie),
      'qh_admin_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0',
    );
  } finally {
    if (previousNodeEnv == null) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});
