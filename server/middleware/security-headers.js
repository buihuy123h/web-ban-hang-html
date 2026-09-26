'use strict';

const { IS_TEST } = require('../config');

/* CSP strict — least privilege theo đúng nguồn web đang dùng:
 * - ảnh: chỉ chính server (/images/*) + icon inline data: (favicon SVG) — đã kiểm chứng
 *   2026-09-25 fixture/seed/DB không có ảnh ngoài (https?://);
 * - connect-src 'self': API gọi cùng origin (explicit, không dựa fallback của default-src);
 * - font/style Google + iframe Google Maps (Contact) đã whitelist sẵn. */
const CSP = [
  "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com", "img-src 'self' data:",
  "connect-src 'self'",
  "frame-src 'self' https://www.google.com https://maps.google.com", "object-src 'none'",
  "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
].join('; ');

/* Tắt toàn bộ API trình duyệt nhạy cảm mà web này không dùng — chặn trước cả khi
 * thư viện tương lai vô tình yêu cầu (payment, usb, bluetooth, serial…). */
const PERMISSIONS_POLICY = [
  'camera=()', 'microphone=()', 'geolocation=()', 'payment=()', 'usb=()',
  'bluetooth=()', 'serial=()', 'idle-detection=()', 'display-capture=()',
  'accelerometer=()', 'gyroscope=()', 'magnetometer=()',
].join(', ');

module.exports = function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', PERMISSIONS_POLICY);
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  // Chặn site khác nhúng ảnh/resource của web này — chống hotlink + rò rỉ cross-origin.
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', CSP);
  // Express chỉ tin X-Forwarded-Proto khi TRUST_PROXY đã được validate; nhánh test mô phỏng proxy cục bộ.
  const testHttpsProxy = IS_TEST && req.socket.remoteAddress === '127.0.0.1'
    && req.get('X-Forwarded-Proto') === 'https';
  if (req.secure || testHttpsProxy) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
};
