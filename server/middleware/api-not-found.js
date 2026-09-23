'use strict';

/* MIDDLEWARE — API không tồn tại → trả JSON thay vì HTML.
 * Mount sau router API: app.use('/api', apiNotFound). */

module.exports = function apiNotFound(req, res) {
  res.status(404).set('Cache-Control', 'no-store').json({ error: 'Không tìm thấy API route.' });
};
