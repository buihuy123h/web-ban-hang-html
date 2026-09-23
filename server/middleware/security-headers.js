'use strict';

const { IS_TEST } = require('../config');

const CSP = [
  "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com", "img-src 'self' data: https:",
  "frame-src 'self' https://www.google.com https://maps.google.com", "object-src 'none'",
  "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
].join('; ');

module.exports = function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', CSP);
  // Express chỉ tin X-Forwarded-Proto khi TRUST_PROXY đã được validate; nhánh test mô phỏng proxy cục bộ.
  const testHttpsProxy = IS_TEST && req.socket.remoteAddress === '127.0.0.1'
    && req.get('X-Forwarded-Proto') === 'https';
  if (req.secure || testHttpsProxy) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
};
