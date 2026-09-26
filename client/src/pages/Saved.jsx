import React from 'react';
import { Link } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import { useCart } from '../context/CartContext';
import ProductCard from '../components/ProductCard';
import Icon from '../components/Icon';
import Breadcrumbs from '../components/Breadcrumbs';
import { formatPrice } from '../utils/format';
import '../App.css';
import './Saved.css';

const Saved = () => {
  const { products, categories, loading } = useCatalog();
  const { savedIds, addToCart, toggleSaved, showToast } = useCart();

  // Giữ đúng thứ tự người dùng bấm "Lưu" thay vì thứ tự trong catalogue.
  const savedProducts = savedIds
    .map((id) => products.find((product) => product.id === id))
    .filter(Boolean);
  const totalValue = savedProducts.reduce((sum, product) => sum + (Number(product.price) || 0), 0);
  const suggestions = products.filter((product) => product.badge === 'hot').slice(0, 4);

  const addAllToCart = () => {
    savedProducts.forEach((product) => addToCart(product));
    showToast(`Đã thêm ${savedProducts.length} món đã lưu vào giỏ.`);
  };

  const clearSaved = () => {
    savedIds.forEach((id) => toggleSaved(id));
    showToast('Đã bỏ lưu toàn bộ sản phẩm.');
  };

  return (
    <main className="container saved-page">
      <Breadcrumbs items={[{ label: 'Sản phẩm đã lưu' }]} />
      <header className="saved-heading">
        <div>
          <p className="eyebrow">Danh sách cá nhân</p>
          <h1>Sản phẩm đã lưu</h1>
          <p>Giữ lại những món đang cân nhắc — đồ cũ hay hết nhanh, lưu trước kẻo người khác chốt mất.</p>
        </div>
        {!loading && savedProducts.length > 0 && (
          <div className="saved-side">
            <span className="saved-count">
              <Icon name="bookmark" size={14} />
              {savedProducts.length} sản phẩm · {formatPrice(totalValue)}
            </span>
            <div className="saved-actions">
              <button type="button" className="btn btn-primary" onClick={addAllToCart}>
                <Icon name="cart" size={16} />Thêm tất cả vào giỏ
              </button>
              <button type="button" className="text-link" onClick={clearSaved}>Bỏ lưu tất cả</button>
            </div>
          </div>
        )}
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
        <>
          <section className="saved-empty">
            <span className="saved-empty-icon" aria-hidden="true"><Icon name="bookmark" size={30} /></span>
            <div className="saved-empty-copy">
              <h2>Danh sách của bạn đang trống</h2>
              <p>Nhấn “Lưu” trên bất kỳ sản phẩm nào để giữ lại ở đây — so sánh giá, cân nhắc rồi chốt đơn khi sẵn sàng.</p>
              <div className="saved-chips">
                {categories.filter((category) => category.key !== 'all').map((category) => (
                  <Link key={category.key} to={`/san-pham?cat=${category.key}`} className="saved-chip">{category.label}</Link>
                ))}
              </div>
            </div>
            <div className="saved-empty-cta">
              <Link to="/san-pham" className="btn btn-primary"><Icon name="grid" size={16} />Khám phá sản phẩm</Link>
              <Link to="/contact" className="text-link">Nhắn để hỏi hàng</Link>
            </div>
          </section>

          {suggestions.length > 0 && (
            <section className="saved-suggest" aria-labelledby="saved-suggest-title">
              <div className="saved-suggest-head">
                <h2 id="saved-suggest-title">Đang bán chạy tại kho</h2>
                <p>Món này hay được chốt nhanh — xem thử trong lúc danh sách còn trống.</p>
              </div>
              <div className="product-grid">
                {suggestions.map((product) => <ProductCard key={product.id} product={product} />)}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
};

export default Saved;
