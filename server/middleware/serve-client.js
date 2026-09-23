'use strict';

/* MIDDLEWARE — Production: serve client build (client/dist) + SPA fallback.
 * - File văn bản đã nén sẵn (.br/.gz) + cache RAM: bundle JS/CSS của Vite đi trên
 *   mạng nhỏ hơn 3-4 lần; phục vụ từ bộ nhớ nên không đụng đĩa sau lần đọc đầu
 *   → phản hồi nhanh và ổn cả khi nhiều người truy cập.
 * - Ưu tiên Brotli (gọn hơn gzip ~15-20%), lùi về gzip, rồi mới tới bản gốc.
 * - Phần còn lại (ảnh, video…): express.static. SPA fallback trả index.html,
 *   riêng /images, /assets thiếu file → 404 thật (trả HTML sẽ khiến <img> lỗi âm thầm). */

const fs = require('fs');
const path = require('path');
const express = require('express');
const { CLIENT_DIST, IS_TEST } = require('../config');
const { precompress } = require('../scripts/precompress');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

const cacheControlFor = (filePath) => {
  // Vite đặt hash vào tên file trong /assets → cache 1 năm là an toàn.
  if (/[\\/]assets[\\/]/.test(filePath)) return 'public, max-age=31536000, immutable';
  if (filePath.endsWith('.html')) return 'no-cache';
  return undefined;
};

/* Gắn middleware serve client build vào app — chỉ khi đã có bản build. */
const setupClientServing = (app) => {
  if (!fs.existsSync(CLIENT_DIST)) return;

  const STATIC_CACHE_MAX = 100;
  const staticCache = new Map(); // key: đường dẫn file nén → { buffer, mtimeMs }

  const readCached = (file) => {
    const mtime = fs.statSync(file).mtimeMs;
    let entry = staticCache.get(file);
    if (!entry || entry.mtimeMs !== mtime) {
      entry = { buffer: fs.readFileSync(file), mtimeMs: mtime };
      if (staticCache.size >= STATIC_CACHE_MAX) staticCache.delete(staticCache.keys().next().value);
      staticCache.set(file, entry);
    }
    return entry.buffer;
  };

  const acceptsEncoding = (req, name) =>
    new RegExp(`(?:^|,)\\s*${name}\\s*(?:;|,|$)`, 'i').test(String(req.headers['accept-encoding'] || ''));

  /* --- 1) File văn bản: phục vụ bản nén sẵn từ cache RAM --- */
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch {
      return next();
    }
    const filePath = path.normalize(path.join(CLIENT_DIST, pathname));
    // Chặn path traversal: đường dẫn phải nằm trong client/dist.
    if (filePath !== CLIENT_DIST && !filePath.startsWith(CLIENT_DIST + path.sep)) return next();
    const ext = path.extname(filePath).toLowerCase();
    if (!MIME[ext]) return next(); // Ảnh & loại lạ → express.static lo (stream từ đĩa).

    let stat;
    try {
      stat = fs.statSync(filePath);
    } catch {
      return next();
    }
    if (!stat.isFile()) return next();

    let encoding = null;
    let serveFile = filePath;
    if (acceptsEncoding(req, 'br') && fs.existsSync(`${filePath}.br`)) {
      encoding = 'br';
      serveFile = `${filePath}.br`;
    } else if (acceptsEncoding(req, 'gzip') && fs.existsSync(`${filePath}.gz`)) {
      encoding = 'gzip';
      serveFile = `${filePath}.gz`;
    }

    let body;
    try {
      body = readCached(serveFile);
    } catch {
      return next(); // Đọc hỏng thì trả thẳng qua express.static cho lành.
    }

    const cacheControl = cacheControlFor(filePath);
    const etag = `"${stat.size.toString(16)}-${Math.round(stat.mtimeMs).toString(16)}${encoding ? `-${encoding}` : ''}"`;
    res.setHeader('Content-Type', MIME[ext]);
    res.setHeader('ETag', etag);
    if (cacheControl) res.setHeader('Cache-Control', cacheControl);
    res.setHeader('Vary', 'Accept-Encoding');
    if (encoding) res.setHeader('Content-Encoding', encoding);
    if ((req.headers['if-none-match'] || '').split(',').some((tag) => tag.trim() === etag)) {
      return res.status(304).end();
    }
    res.setHeader('Content-Length', String(body.length));
    if (req.method === 'HEAD') return res.end();
    return res.end(body);
  });

  /* --- 2) Phần còn lại (ảnh, video…): express.static giữ nguyên --- */
  app.use(express.static(CLIENT_DIST, {
    index: 'index.html',
    setHeaders(res, filePath) {
      const cacheControl = cacheControlFor(filePath);
      if (cacheControl) res.setHeader('Cache-Control', cacheControl);
    },
  }));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/images/') || req.path.startsWith('/assets/')) {
      return res.status(404).end('Not found');
    }
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
};

/* Chạy thật (không test): tự nén sẵn nếu client build chưa có bản .br/.gz.
 * Được gọi từ startServer() — test dùng app.listen trực tiếp nên không bao giờ đụng vào. */
const ensurePrecompressed = () => {
  if (IS_TEST || !fs.existsSync(CLIENT_DIST)) return 0;
  const hasAnyBr = (function find(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (find(full)) return true;
      } else if (e.name.endsWith('.br')) {
        return true;
      }
    }
    return false;
  })(CLIENT_DIST);
  if (hasAnyBr) return 0;
  const r = precompress(CLIENT_DIST);
  console.log(`[precompress] Đã nén sẵn ${r.created} bản (Brotli + Gzip) cho client build.`);
  return r.created;
};

module.exports = { setupClientServing, ensurePrecompressed };
