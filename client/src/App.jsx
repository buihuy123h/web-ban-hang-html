import React, { Suspense, lazy, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import NavBar from './components/NavBar';
import Footer from './components/Footer';
import ContactFab from './components/ContactFab';
import Toast from './components/Toast';
import ChatWidget from './components/ChatWidget';
import ScrollToTop from './components/ScrollToTop';
import Home from './pages/Home';
import { CartProvider } from './context/CartContext';
import { CatalogProvider } from './context/CatalogContext';
import { HERO_IMAGE } from './data/productImages';
import './App.css';

/* Tách bundle theo route: Home giữ eager (trang landing cần LCP nhanh nhất),
   7 trang còn lại lazy-load khi cần → giảm dung lượng JS/CSS tải lần đầu. */
const Products = lazy(() => import('./pages/Products'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const About = lazy(() => import('./pages/About'));
const Contact = lazy(() => import('./pages/Contact'));
const Cart = lazy(() => import('./pages/Cart'));
const Saved = lazy(() => import('./pages/Saved'));
const NotFound = lazy(() => import('./pages/NotFound'));

/* Placeholder hiển thị trong lúc tải chunk của trang lazy. */
const RouteLoader = () => (
  <div className="route-loader" role="status" aria-live="polite">
    <span className="route-loader-spinner" aria-hidden="true" />
    <span>Đang tải trang...</span>
  </div>
);

/* Bọc Routes trong div key theo pathname → mỗi lần đổi trang có hiệu ứng vào mượt. */
const PageRoutes = () => {
  const location = useLocation();
  return (
    <div className="page-enter" key={location.pathname} style={{ '--page-hero-image': `url("${HERO_IMAGE}")` }}>
      <Suspense fallback={<RouteLoader />}>
        <Routes location={location}>
          <Route path="/" element={<Home />} />
          <Route path="/san-pham" element={<Products />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/saved" element={<Saved />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </div>
  );
};

function App() {
  /* Trợ lý AI chat: state duy nhất ở App — ContactFab mở, ChatWidget tự đóng
     (Esc / nút X / bấm vào món đồ gợi ý) và quay về ContactFab như cũ. */
  const [chatOpen, setChatOpen] = useState(false);
  return (
    <CartProvider>
      <CatalogProvider>
        <Router>
          <ScrollToTop />
          <NavBar />
          <PageRoutes />
          <Footer />
          <ContactFab onOpenChat={() => setChatOpen(true)} />
          <ChatWidget open={chatOpen} onClose={() => setChatOpen(false)} />
          <Toast />
        </Router>
      </CatalogProvider>
    </CartProvider>
  );
}

export default App;
