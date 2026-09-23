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
  for (const origin of origins) {
    let url;
    try { url = new URL(origin); } catch { throw new ConfigError('CORS_ORIGIN phải chứa origin tuyệt đối hợp lệ.'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new ConfigError('CORS_ORIGIN phải chỉ gồm scheme, host và port.');
    }
    if (url.origin !== origin) throw new ConfigError('CORS_ORIGIN phải dùng định dạng origin chuẩn.');
  }
  return [...new Set(origins)];
};

const allowedOrigins = parseOrigins();

module.exports = function cors(req, res, next) {
  const origin = req.get('Origin');
  const wildcard = allowedOrigins[0] === '*';
  const allowed = !origin || wildcard || allowedOrigins.includes(origin);
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
