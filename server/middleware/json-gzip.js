'use strict';

/* MIDDLEWARE — nén (Brotli/Gzip) + ETag/304 cho phản hồi JSON của API.
 * - Body ≥ 1KB: ưu tiên Brotli (gọn hơn gzip ~15-20%) khi client hỗ trợ, lùi về gzip
 *   cho client cũ. Kết quả nén cache theo nội dung + loại nén → request sau cùng nội dung
 *   không phải nén lại (tiết kiệm cả băng thông lẫn CPU).
 * - Gắn ETag theo nội dung; client gửi If-None-Match khớp → 304 không thân thể.
 * - Body nhỏ hơn 1KB: express tự lo ETag/304. */

const zlib = require('zlib');
const crypto = require('crypto');

const BROTLI_QUALITY = 5; // Cân bằng tốc độ/gọn — đã có cache nên mỗi nội dung chỉ nén 1 lần.
const compressCache = new Map(); // key: `<etag>|<encoding>` → { packed }
const COMPRESS_CACHE_MAX = 128;

const makeEtag = (body) => `"${body.length.toString(16)}-${crypto.createHash('sha1').update(body).digest('hex').slice(0, 16)}"`;

/* Nối thêm giá trị vào header Vary mà không ghi đè giá trị đã có (vd "Origin" từ CORS). */
const appendVary = (res, value) => {
  const parts = String(res.getHeader('Vary') || '').split(',').map((v) => v.trim()).filter(Boolean);
  if (!parts.some((p) => p.toLowerCase() === value.toLowerCase())) parts.push(value);
  res.setHeader('Vary', parts.join(', '));
};

const supportsBrotli = (header) => /(?:^|,)\s*br\s*(?:;|,|$)/i.test(header);
const supportsGzip = (header) => /(?:^|,)\s*(?:x-)?gzip\s*(?:;|,|$)/i.test(header);

module.exports = function jsonGzip(req, res, next) {
  const acceptEncoding = String(req.headers['accept-encoding'] || '');
  const encoding = supportsBrotli(acceptEncoding) ? 'br' : (supportsGzip(acceptEncoding) ? 'gzip' : null);
  if (!encoding) return next(); // Client không nhận nén → express json thường.

  const originalJson = res.json.bind(res);
  res.json = (payload) => {
    const body = Buffer.from(JSON.stringify(payload));
    if (body.length < 1024) return originalJson(payload);

    const etag = makeEtag(body);
    res.setHeader('ETag', etag);
    const ifNoneMatch = req.headers['if-none-match'];
    if (ifNoneMatch && ifNoneMatch.split(',').some((tag) => tag.trim() === etag)) {
      appendVary(res, 'Accept-Encoding');
      return res.status(304).end();
    }

    const cacheKey = `${etag}|${encoding}`;
    let entry = compressCache.get(cacheKey);
    if (!entry) {
      entry = {
        packed: encoding === 'br'
          ? zlib.brotliCompressSync(body, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: BROTLI_QUALITY } })
          : zlib.gzipSync(body),
      };
      if (compressCache.size >= COMPRESS_CACHE_MAX) compressCache.delete(compressCache.keys().next().value);
      compressCache.set(cacheKey, entry);
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Encoding', encoding);
    appendVary(res, 'Accept-Encoding');
    return res.end(entry.packed);
  };
  return next();
};
