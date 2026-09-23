'use strict';

/* Helpers dùng chung cho các controller. */

/* Trả 503 thống nhất khi DB chưa sẵn sàng — không lộ chi tiết kết nối. */
const databaseUnavailable = (res) => res.status(503)
  .set('Cache-Control', 'no-store')
  .json({ error: 'Cơ sở dữ liệu tạm thời không sẵn sàng. Vui lòng thử lại sau.' });

module.exports = { databaseUnavailable };
