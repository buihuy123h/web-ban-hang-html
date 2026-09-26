import React, { useEffect, useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import Icon from './Icon';
import './NavBar.css';

const NavBar = () => {
  const { cartCount, savedCount } = useCart();
  const [scrolled, setScrolled] = useState(false);

  // Hiệu ứng "đảo nổi": navbar nhận bóng đậm hơn khi người dùng cuộn xuống.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`site-header${scrolled ? ' scrolled' : ''}`}>
      <nav className="navbar" aria-label="Điều hướng chính">
        <Link to="/" className="logo" aria-label="Đồ Cũ Quang Huy, trang chủ">
          <span className="logo-mark" aria-hidden="true">QH</span>
          <span>Đồ Cũ<br /><small>Quang Huy</small></span>
        </Link>
        <ul className="nav-links">
          <li><NavLink to="/" end><Icon name="home" size={18} /><span className="nl-label">Trang chủ</span></NavLink></li>
          <li><NavLink to="/san-pham"><Icon name="grid" size={19} /><span className="nl-label">Sản phẩm</span></NavLink></li>
          <li><NavLink to="/saved"><Icon name="bookmark" size={18} /><span className="nl-label">Đã lưu</span>{savedCount > 0 && <span className="nav-count" key={savedCount} aria-hidden="true">{savedCount}</span>}</NavLink></li>
          <li className="nav-cart-mobile"><NavLink to="/cart"><Icon name="cart" size={19} /><span className="nl-label">Giỏ</span>{cartCount > 0 && <span className="nav-count" key={cartCount} aria-hidden="true">{cartCount}</span>}</NavLink></li>
          <li><NavLink to="/about"><Icon name="spark" size={18} /><span className="nl-label">Câu chuyện</span></NavLink></li>
          <li><NavLink to="/contact"><Icon name="phone" size={18} /><span className="nl-label">Liên hệ</span></NavLink></li>
        </ul>
        <Link to="/cart" className="cart-btn" aria-label={`Giỏ hàng, ${cartCount} sản phẩm`}>
          <Icon name="cart" size={18} />
          <span>Giỏ hàng</span>
          <strong key={cartCount} aria-hidden="true">{String(cartCount).padStart(2, '0')}</strong>
        </Link>
      </nav>
    </header>
  );
};

export default NavBar;