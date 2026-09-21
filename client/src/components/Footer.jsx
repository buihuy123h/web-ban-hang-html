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
          <div className="f-logo">Đồ Cũ Quang Huy</div>
          <p>Thanh lý đồ cũ còn dùng tốt cho quán ăn, phòng trọ và gia đình — giá tốt, kiểm tra kỹ trước khi giao.</p>
          <form className="f-news" onSubmit={subscribe} noValidate>
            <label htmlFor="footer-email">Nhận thông báo đợt hàng mới về và mẹo chọn đồ cũ còn tốt</label>
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
          <a href="tel:0374034430"><Icon name="phone" size={14} />0374 034 430 · Zalo</a>
          <a href="https://www.facebook.com/ocuquanghuy/" target="_blank" rel="noreferrer"><Icon name="spark" size={14} />facebook.com/ocuquanghuy</a>
          <span>Kiểm tra hàng trước khi nhận</span>
          <span>Gửi qua nhà xe toàn quốc</span>
        </div>
        <div className="f-col">
          <h5>Showroom</h5>
          <span><Icon name="pin" size={14} />707 Tân Sơn, P. An Hội Tây, Gò Vấp, TP.HCM</span>
          <span><Icon name="clock" size={14} />Mở cửa 08:00 đến 21:00 mỗi ngày</span>
        </div>
      </div>
      <div className="f-bottom"><span>© 2026 Đồ Cũ Quang Huy</span><span>Đồ cũ còn tốt — giá thì như mới.</span></div>
    </footer>
  );
};

export default Footer;