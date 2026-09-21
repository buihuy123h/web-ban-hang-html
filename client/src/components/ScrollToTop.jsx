import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Icon from './Icon';

const ScrollToTop = () => {
  const { pathname } = useLocation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 640);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return visible ? (
    <button type="button" className="back-to-top" onClick={scrollTop} aria-label="Quay về đầu trang">
      <Icon name="arrowUp" size={19} strokeWidth={2} />
    </button>
  ) : null;
};

export default ScrollToTop;