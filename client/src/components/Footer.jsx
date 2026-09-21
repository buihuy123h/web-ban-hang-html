import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import Icon from './Icon';
import './Footer.css';

const Footer = () => {
  const { showToast } = useCart();
  const [email, setEmail] = useState('');

  const subscribe = (event) => {
    event.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      showToast('Vui lòng nhập một địa chỉ email hợp lệ.');
      return;
    }
    setEmail('');
    showToast('Cảm ơn bạn! Hẹn gặp trong những bản cập nhật sắp tới.');
  };

  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="f-col brand">
          <div className="f-logo">Đồ Inox Gia Đình</div>
          <p>Vật dụng inox bền, an toàn và được tuyển chọn cho căn bếp Việt từ năm 2015.</p>
          <form className="f-news" onSubmit={subscribe} noValidate>
            <label htmlFor="footer-email">Nhận cập nhật sản phẩm mới và mẹo chăm sóc đồ inox</label>
            <div className="f-news-row">
              <input id="footer-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email của bạn" autoComplete="email" />
              <button type="submit">Đăng ký</button>
            </div>
          </form>
        </div>
        <div className="f-col">
          <h5>Khám phá</h5>
          <Link to="/">Trang chủ</Link>
          <Link to="/san-pham">Sản phẩm</Link>
          <Link to="/about">Câu chuyện</Link>
          <Link to="/contact">Liên hệ</Link>
          <Link to="/cart">Giỏ hàng</Link>
          <Link to="/saved">Sản phẩm đã lưu</Link>
        </div>
        <div className="f-col">
          <h5>Hỗ trợ</h5>
          <a href="tel:19001234"><Icon name="phone" size={14} />1900 1234</a>
          <a href="mailto:hello@doinox.vn"><Icon name="mail" size={14} />hello@doinox.vn</a>
          <span>Đổi trả trong 30 ngày</span>
          <span>Bảo hành 24 tháng</span>
        </div>
        <div className="f-col">
          <h5>Showroom</h5>
          <span><Icon name="pin" size={14} />123 Nguyễn Văn Cừ, Quận 1, TP.HCM</span>
          <span><Icon name="clock" size={14} />Mở cửa 08:00 đến 21:00 mỗi ngày</span>
        </div>
      </div>
      <div className="f-bottom"><span>© 2026 Đồ Inox Gia Đình</span><span>Thiết kế cho những vòng đời dài.</span></div>
    </footer>
  );
};

export default Footer;