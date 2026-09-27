'use strict';

const { ConfigError } = require('../lib/db');

const parseOrigins = () => {
  const raw = String(process.env.CORS_ORIGIN || '').trim();
  if (!raw) return process.env.NODE_ENV === 'production' ? [] : ['*'];
  const origins = raw.split(',').map((item) => item.trim()).filter(Boolean);
  if (!origins.length) throw new ConfigError('CORS_ORIGIN không hợp lệ.');
  if (origins.includes('*')) {
    if (process.env.NODE_ENV === 'production') throw new ConfigError('CORS_ORIGIN không được là * trong production.');
    if (origins.length !== 1) throw new ConfigError('CORS_ORIGIN=* không được kết hợp origin khác.');
    return origins;
  }
  const patterns = new Set();
  for (const origin of origins) {
    let url;
    try { url = new URL(origin); } catch { throw new ConfigError('CORS_ORIGIN phải chứa origin tuyệt đối hợp lệ.'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new ConfigError('CORS_ORIGIN phải chỉ gồm scheme, host và port.');
    }
    // Hỗ trợ wildcard subdomain: https://*.vercel.app — "*" phải là 1 label duy nhất, đứng đầu host.
    const starCount = (url.hostname.match(/\*/g) || []).length;
    if (starCount > 1 || (starCount === 1 && !url.hostname.startsWith('*.'))) {
      throw new ConfigError('CORS_ORIGIN wildcard chỉ hỗ trợ dạng "https://*.ten-mien" (một * ở đầu host).');
    }
    if (url.origin !== origin) throw new ConfigError('CORS_ORIGIN phải dùng định dạng origin chuẩn.');
    patterns.add(url.origin);
  }
  return [...patterns];
};

/* Khớp origin request với 1 mục trong whitelist:
 * - Exact match (https://abc.vercel.app === https://abc.vercel.app)
 * - Hoặc mục whitelist có dạng https://*.ten-mien → origin request phải là con trực tiếp (1 label). */
const matchOrigin = (allowed, origin) => {
  if (allowed === origin) return true;
  try {
    const a = new URL(allowed);
    // Mục wildcard: host dạng *.ten-mien → origin request phải là con trực tiếp (đúng 1 label trước đuôi).
    if (!a.hostname.startsWith('*.')) return false;
    const suffix = a.hostname.slice(1); // ".vercel.app"
    const url = new URL(origin);
    return url.protocol === a.protocol
      && url.hostname.toLowerCase().endsWith(suffix.toLowerCase())
      && url.hostname.length > suffix.length
      && !url.hostname.slice(0, -suffix.length).includes('.');
  } catch { return false; }
};

const allowedOrigins = parseOrigins();

module.exports = function cors(req, res, next) {
  const origin = req.get('Origin');
  const wildcard = allowedOrigins[0] === '*';
  const allowed = !origin || wildcard || allowedOrigins.some((item) => matchOrigin(item, origin));
  if (origin) res.vary('Origin');
  if (origin && allowed) res.setHeader('Access-Control-Allow-Origin', wildcard ? '*' : origin);
  if (req.method === 'OPTIONS') {
    if (!allowed) return res.status(204).set('Cache-Control', 'no-store').end();
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Request-Id');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    return res.sendStatus(204);
  }
  return next();
};

module.exports.parseOrigins = parseOrigins;
module.exports.matchOrigin = matchOrigin;
