import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Icon from './Icon';
import './ContactFab.css';

/* ===== Nút liên hệ nổi (Gọi điện · Zalo · Messenger · TikTok) =====
   Khách bấm là nhắn tin/gọi luôn. Kênh là thông tin thật của cửa hàng —
   khi thay số/đổi link chỉ cần sửa ở CONTACT_ITEMS này. */
const CONTACT_ITEMS = [
  { key: 'tiktok', icon: 'tiktok', label: 'TikTok · @cquanghuy8', href: 'https://www.tiktok.com/@cquanghuy8', tone: 'tiktok', delay: 3 },
  { key: 'messenger', icon: 'messenger', label: 'Nhắn tin Messenger', href: 'https://m.me/100090912844650', tone: 'messenger', delay: 2 },
  { key: 'zalo', icon: 'zalo', label: 'Nhắn tin Zalo', href: 'https://zalo.me/0374034430', tone: 'zalo', delay: 1 },
  { key: 'phone', icon: 'phone', label: 'Gọi 0374 034 430', href: 'tel:0374034430', tone: 'phone', delay: 0 },
];

const ContactFab = () => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const location = useLocation();

  /* Đổi trang → gập menu lại cho gọn */
  useEffect(() => { setOpen(false); }, [location.pathname]);

  /* Bấm ra ngoài hoặc nhấn Esc → gập */
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`contact-fab${open ? ' open' : ''}`}>
      <ul className="cf-menu" id="cf-menu" aria-label="Kênh liên hệ nhanh">
        {CONTACT_ITEMS.map((item) => (
          <li key={item.key} className="cf-item" style={{ '--cf-delay': item.delay }}>
            <a
              className={`cf-link cf-${item.tone}`}
              href={item.href}
              target={item.href.startsWith('http') ? '_blank' : undefined}
              rel={item.href.startsWith('http') ? 'noreferrer' : undefined}
            >
              <span className="cf-bubble">
                <Icon name={item.icon} size={item.tone === 'phone' ? 20 : 22} strokeWidth={1.9} />
              </span>
              <span className="cf-label">{item.label}</span>
            </a>
          </li>
        ))}
      </ul>
      <div className="cf-toggle-row">
        <span className="cf-hint" aria-hidden="true">Cần hỗ trợ?</span>
        <button
          type="button"
          className="cf-toggle"
          aria-expanded={open}
          aria-controls="cf-menu"
          aria-label={open ? 'Đóng menu liên hệ' : 'Mở menu liên hệ nhanh'}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="cf-ping" aria-hidden="true" />
          <span className="cf-ic cf-ic-chat" aria-hidden="true"><Icon name="chat" size={24} /></span>
          <span className="cf-ic cf-ic-close" aria-hidden="true"><Icon name="close" size={23} strokeWidth={2.1} /></span>
        </button>
      </div>
    </div>
  );
};

export default ContactFab;