import React from 'react';
import { Link } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import { useCart } from '../context/CartContext';
import ProductCard from '../components/ProductCard';
import Icon from '../components/Icon';
import '../App.css';
import './Saved.css';

const Saved = () => {
  const { products, loading } = useCatalog();
  const { savedIds } = useCart();
  const savedProducts = products.filter((product) => savedIds.includes(product.id));

  return (
    <main className="container saved-page">
      <header className="saved-heading">
        <div>
          <p className="eyebrow">Danh sách cá nhân</p>
          <h1>Sản phẩm đã lưu</h1>
          <p>Một nơi để giữ lại những món bạn muốn cân nhắc trước khi đưa vào giỏ.</p>
        </div>
        <span>{savedProducts.length} sản phẩm</span>
      </header>

      {loading ? (
        <div className="product-grid" aria-hidden="true">
          {Array.from({ length: 8 }, (_, index) => (
            <div className="skel-card" key={index}>
              <div className="skel skel-media" />
              <div className="skel skel-line w40" />
              <div className="skel skel-line w70" />
              <div className="skel-strip">
                <div className="skel skel-line w40" />
                <div className="skel skel-chip" />
              </div>
            </div>
          ))}
        </div>
      ) : savedProducts.length ? (
        <div className="product-grid">
          {savedProducts.map((product) => <ProductCard key={product.id} product={product} />)}
        </div>
      ) : (
        <section className="saved-empty">
          <div>
            <h2>Danh sách của bạn đang trống</h2>
            <p>Nhấn “Lưu” trên bất kỳ sản phẩm nào để giữ lại và so sánh sau.</p>
          </div>
          <Link to="/" className="btn btn-primary"><Icon name="bookmark" size={16} />Khám phá sản phẩm</Link>
        </section>
      )}
    </main>
  );
};

export default Saved;
