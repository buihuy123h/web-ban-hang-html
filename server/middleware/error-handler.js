'use strict';

/* MIDDLEWARE — báo lỗi tập trung (luôn mount cuối pipeline).
 * - JSON hỏng → 400; lỗi DB → 503 no-store (không lộ chi tiết);
 * - còn lại: /api → 500 JSON, ngoài /api → 500 HTML. */

const { IS_TEST } = require('../config');

// eslint-disable-next-line no-unused-vars
module.exports = function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).set('Cache-Control', 'no-store').json({ error: 'JSON gửi lên không hợp lệ.' });
  }
  if (err && (err.type === 'entity.too.large' || err.status === 413)) {
    return res.status(413).set('Cache-Control', 'no-store').json({ error: 'Dữ liệu gửi lên vượt quá giới hạn cho phép.' });
  }
  if (err && err.isDatabaseError) {
    if (!IS_TEST) console.error(`[database] request_id=${req.requestId || 'unknown'} code=${err.code || 'QUERY_FAILED'}`);
    return res.status(503).set('Cache-Control', 'no-store')
      .json({ error: 'Cơ sở dữ liệu tạm thời không sẵn sàng. Vui lòng thử lại sau.' });
  }
  if (!IS_TEST) console.error(`[error] request_id=${req.requestId || 'unknown'} code=${(err && (err.code || err.name)) || 'UNEXPECTED_ERROR'}`);
  // Chỉ nhận status lỗi hợp lệ (integer 400–599) từ err — lỗi ngoài ý muốn mang status
  // lạ (chuỗi, 2xx/3xx, 999…) phải về 500, không để làm sai chuẩn HTTP của response.
  const status = Number.isInteger(err && err.status) && err.status >= 400 && err.status <= 599
    ? err.status
    : 500;
  if (String(req.originalUrl).startsWith('/api')) {
    return res.status(status).set('Cache-Control', 'no-store')
      .json({ error: 'Lỗi máy chủ. Vui lòng thử lại.' });
  }
  return res.status(500).send('Lỗi máy chủ.');
};
