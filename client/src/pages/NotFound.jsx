import React from 'react';
import { Link } from 'react-router-dom';

const NotFound = () => (
  <main className="container">
    <section className="empty-state not-found" aria-labelledby="not-found-title">
      <p className="error-code">404</p>
      <h1 id="not-found-title">Không tìm thấy trang</h1>
      <p>Đường dẫn có thể đã thay đổi hoặc không còn tồn tại.</p>
      <Link to="/" className="btn btn-primary">Về trang sản phẩm</Link>
    </section>
  </main>
);

export default NotFound;