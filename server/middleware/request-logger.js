'use strict';

const crypto = require('crypto');
const { IS_TEST } = require('../config');
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,64}$/;

module.exports = function requestLogger(req, res, next) {
  const supplied = String(req.get('X-Request-Id') || '');
  req.requestId = REQUEST_ID_PATTERN.test(supplied) ? supplied : crypto.randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  const startedAt = process.hrtime.bigint();
  if (!IS_TEST) {
    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - startedAt) / 1e6;
      const safePath = String(req.path || '/').replace(/[\r\n]/g, '');
      console.log(`[request] id=${req.requestId} method=${req.method} path=${safePath} status=${res.statusCode} duration_ms=${ms.toFixed(1)}`);
    });
  }
  next();
};

