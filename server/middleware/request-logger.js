'use strict';

const crypto = require('crypto');
const { IS_TEST } = require('../config');
const { parseInteger } = require('../lib/db');
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,64}$/;

/* Đọc LOG_QUIET_PATHS: danh sách path phân tách dấu phẩy (trim, bỏ entry rỗng).
 * Unset/rỗng → default ['/api/health'] — muốn tắt hẳn quiet logging thì set path không tồn tại. */
const parseQuietPaths = (raw = process.env.LOG_QUIET_PATHS) => {
  const value = String(raw == null ? '' : raw).trim();
  if (!value) return ['/api/health'];
  return value.split(',').map((entry) => entry.trim()).filter((entry) => entry.length > 0);
};

/* Factory theo pattern middleware/rate-limit.js — test tiêm slowMs/quietPaths/isTest/log;
 * module.exports vẫn là middleware mặc định nên app.use(requestLogger) trong app.js không đổi. */
const createRequestLogger = ({ slowMs, quietPaths, isTest, log } = {}) => {
  /* LOG_SLOW_MS validate fail-fast ngay khi load module (giống rate-limit) — sai giá trị →
   * server từ chối khởi động; tiêm slowMs trực tiếp thì bỏ qua env. */
  const threshold = Number.isFinite(slowMs)
    ? slowMs
    : parseInteger('LOG_SLOW_MS', 1000, { min: 50, max: 3_600_000 });
  const quietList = Array.isArray(quietPaths) ? quietPaths : parseQuietPaths();
  const testMode = typeof isTest === 'boolean' ? isTest : IS_TEST;
  const write = typeof log === 'function' ? log : console.log;

  return function requestLogger(req, res, next) {
    const supplied = String(req.get('X-Request-Id') || '');
    req.requestId = REQUEST_ID_PATTERN.test(supplied) ? supplied : crypto.randomUUID();
    res.setHeader('X-Request-Id', req.requestId);
    const startedAt = process.hrtime.bigint();
    if (!testMode) {
      res.on('finish', () => {
        /* Quiet path khớp CHÍNH XÁC req.path (query string không tính) → bỏ dòng log request,
         * nhưng X-Request-Id vẫn đã được set ở trên như thường lệ. */
        if (quietList.includes(String(req.path || '/'))) return;
        const ms = Number(process.hrtime.bigint() - startedAt) / 1e6;
        const safePath = String(req.path || '/').replace(/[\r\n]/g, '');
        /* So sánh trên giá trị ms thô: vượt ngưỡng (strictly greater) → [slow]. */
        const prefix = ms > threshold ? '[slow]' : '[request]';
        /* bytes= chỉ khi response có header Content-Length lúc finish (chunked/nén → không có). */
        const contentLength = res.getHeader('Content-Length');
        const bytesPart = contentLength == null ? '' : ` bytes=${contentLength}`;
        write(`${prefix} id=${req.requestId} method=${req.method} path=${safePath} status=${res.statusCode} duration_ms=${ms.toFixed(1)}${bytesPart}`);
      });
    }
    next();
  };
};

const requestLogger = createRequestLogger();

module.exports = requestLogger;
module.exports.createRequestLogger = createRequestLogger;

