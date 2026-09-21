import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import NavBar from './components/NavBar';
import Footer from './components/Footer';
import Toast from './components/Toast';
import ScrollToTop from './components/ScrollToTop';
import Home from './pages/Home';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import About from './pages/About';
import Contact from './pages/Contact';
import Cart from './pages/Cart';
import Saved from './pages/Saved';
import NotFound from './pages/NotFound';
import { CartProvider } from './context/CartContext';
import { CatalogProvider } from './context/CatalogContext';
import './App.css';

/* Bọc Routes trong div key theo pathname → mỗi lần đổi trang có hiệu ứng vào mượt. */
const PageRoutes = () => {
  const location = useLocation();
  return (
    <div className="page-enter" key={location.pathname}>
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
    </div>
  );
};

function App() {
  return (
    <CartProvider>
      <CatalogProvider>
        <Router>
          <ScrollToTop />
          <NavBar />
          <PageRoutes />
          <Footer />
          <Toast />
        </Router>
      </CatalogProvider>
    </CartProvider>
  );
}

export default App;
