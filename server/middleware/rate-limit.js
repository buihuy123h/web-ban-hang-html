'use strict';

const { IS_TEST } = require('../config');
const { parseInteger } = require('../lib/db');

const createRateLimiter = ({
  maxEnv, windowEnv, defaultMax, defaultWindowMs = 60_000,
  message = 'Quá nhiều yêu cầu từ máy của bạn. Vui lòng thử lại sau ít phút.',
  maxBucketsEnv = 'RATE_LIMIT_BUCKETS_MAX', defaultMaxBuckets = 10_000,
} = {}) => {
  const limit = parseInteger(maxEnv, IS_TEST ? 100_000 : defaultMax, { min: 1, max: 1_000_000 });
  const windowMs = parseInteger(windowEnv, defaultWindowMs, { min: 1000, max: 3_600_000 });
  const maxBuckets = parseInteger(maxBucketsEnv, defaultMaxBuckets, { min: 100, max: 100_000 });
  const buckets = new Map();
  const sweep = (now = Date.now()) => {
    for (const [key, bucket] of buckets) if (bucket.reset <= now) buckets.delete(key);
    while (buckets.size >= maxBuckets) buckets.delete(buckets.keys().next().value);
  };
  const sweeper = setInterval(sweep, windowMs);
  sweeper.unref?.();

  const middleware = (req, res, next) => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.reset <= now) {
      if (buckets.size >= maxBuckets) sweep(now);
      bucket = { count: 0, reset: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    res.setHeader('X-RateLimit-Limit', String(limit));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, limit - bucket.count)));
    if (bucket.count > limit) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((bucket.reset - now) / 1000))));
      return res.status(429).set('Cache-Control', 'no-store').json({ error: message });
    }
    return next();
  };
  middleware.buckets = buckets;
  middleware.close = () => clearInterval(sweeper);
  return middleware;
};

const apiRateLimit = createRateLimiter({
  maxEnv: 'RATE_LIMIT_MAX', windowEnv: 'RATE_LIMIT_WINDOW_MS', defaultMax: 240,
});
const orderRateLimit = createRateLimiter({
  maxEnv: 'ORDER_RATE_MAX', windowEnv: 'ORDER_RATE_WINDOW_MS', defaultMax: 10,
  maxBucketsEnv: 'ORDER_RATE_BUCKETS_MAX',
  message: 'Bạn đã gửi quá nhiều yêu cầu đặt hàng. Vui lòng thử lại sau.',
});

module.exports = apiRateLimit;
module.exports.createRateLimiter = createRateLimiter;
module.exports.orderRateLimit = orderRateLimit;
