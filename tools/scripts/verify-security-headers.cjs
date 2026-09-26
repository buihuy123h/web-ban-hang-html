#!/usr/bin/env node
'use strict';

/* QA SCRIPT — verify security headers trên app memory-model (KHÔNG cần PostgreSQL).
 * Chạy từ gốc repo:  node tools/scripts/verify-security-headers.cjs [port]
 * Boot app (NODE_ENV=test → memory fixture) + serve client build thật, rồi request:
 *   GET /            → trang HTML build (CSP/CORP/Permissions-Policy phải có đủ)
 *   GET /images/...  → ảnh tĩnh (phải 200, cache 30 ngày, kèm header bảo mật)
 *   GET /api/products → API memory (phải 200)
 * Dùng cho QA task 2026-09-25-tang-cuong-bao-mat-chieu-sau (AC1–AC4, AC7). */

const path = require('path');

process.env.NODE_ENV = 'test'; // memory model — không đụng DB thật
const serverRoot = path.resolve(__dirname, '..', '..', 'server');
const { app } = require(path.join(serverRoot, 'app'));

const s = app.listen(Number(process.argv[2]) || 3100, '127.0.0.1', async () => {
  const base = `http://127.0.0.1:${s.address().port}`;
  const lines = [];
  try {
    const home = await fetch(`${base}/`);
    lines.push(`HOME=${home.status}`);
    lines.push(`CSP=${home.headers.get('content-security-policy')}`);
    lines.push(`CORP=${home.headers.get('cross-origin-resource-policy')}`);
    lines.push(`PP=${home.headers.get('permissions-policy')}`);
    const img = await fetch(`${base}/images/catalog/bat-dia.jpg`);
    lines.push(`IMG=${img.status} type=${img.headers.get('content-type')} cache=${img.headers.get('cache-control')}`);
    const api = await fetch(`${base}/api/products`);
    lines.push(`API=${api.status} len=${(await api.text()).length}`);
  } catch (err) {
    lines.push(`ERR=${err.message}`);
  }
  console.log(lines.join('\n'));
  // Đợi server đóng xong hẳn rồi mới thoát — gọi process.exit giữa chừng làm libuv
  // trên Windows phun assertion UV_HANDLE_CLOSING (không ảnh hưởng kết quả verify).
  s.close(() => {
    setTimeout(() => process.exit(0), 100).unref();
  });
});
