import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import { useCart } from '../context/CartContext';
import { formatPrice } from '../utils/format';
import ProductCard from '../components/ProductCard';
import Icon from '../components/Icon';
import { categoryImages, getProductGallery, getProductPosition, getViewImage, handleImgError } from '../data/productImages';
import '../App.css';
import './ProductDetail.css';

const FALLBACK_VIEWS = [0, 1, 2];

const trustRows = [
  { icon: 'shield', label: 'Đã kiểm tra & vệ sinh kỹ' },
  { icon: 'refresh', label: 'Xem hàng / video thử trước khi chốt' },
  { icon: 'truck', label: 'Gửi qua nhà xe toàn quốc' },
];

const ProductDetail = () => {
  const { id } = useParams();
  const { products, loading, error, reload } = useCatalog();
  const product = products.find((item) => item.id === Number(id));
  const [qty, setQty] = useState(1);
  const [view, setView] = useState(0);
  const { addToCart, showToast, toggleSaved, isSaved } = useCart();

  if (loading) {
    return (
      <main className="container" aria-hidden="true">
        <div className="detail-skel">
          <div className="skel skel-media-lg" />
          <div className="skel-col">
            <div className="skel skel-line w40" />
            <div className="skel skel-line h1" />
            <div className="skel skel-line" />
            <div className="skel skel-line w70" />
            <div className="skel skel-line price" />
            <div className="skel skel-line" />
            <div className="skel skel-btn" />
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="container">
        <div className="empty-state">
          <h3>Không tải được sản phẩm</h3>
          <p>{error}</p>
          <button type="button" className="btn btn-outline" onClick={reload}>
            <Icon name="refresh" size={16} />
            Thử lại
          </button>
        </div>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="container">
        <div className="empty-state">
          <h3>Sản phẩm không tồn tại</h3>
          <Link to="/" className="btn btn-primary">Về trang sản phẩm</Link>
        </div>
      </main>
    );
  }

  const saved = isSaved(product.id);
  const discount = product.oldPrice ? Math.round((1 - product.price / product.oldPrice) * 100) : null;
  const related = products.filter((item) => item.category === product.category && item.id !== product.id).slice(0, 4);
  // Có gallery ảnh riêng trong DB → đúng số ảnh đó; chưa có → 3 "góc xem" từ ảnh chính.
  const gallery = getProductGallery(product);
  const views = gallery.length ? gallery.map((_, index) => index) : FALLBACK_VIEWS;
  const handleAdd = () => {
    addToCart(product, qty);
    showToast(`Đã thêm ${qty} sản phẩm vào giỏ`);
  };

  return (
    <main className="container">
      <nav className="crumbs" aria-label="Đường dẫn">
        <Link to="/">Sản phẩm</Link><span>/</span><span>{product.categoryLabel}</span><span>/</span><strong>{product.name}</strong>
      </nav>
      <section className="detail-grid">
        <div className="detail-gallery">
          <div className="detail-media">
            <img
              src={getViewImage(product, view)}
              alt={product.name}
              style={{ objectPosition: getProductPosition(product, view) }}
              onError={(event) => handleImgError(event, categoryImages[product.category])}
              decoding="async"
            />
            {discount && <span className="d-discount">−{discount}%</span>}
          </div>
          <div className="gallery-views" aria-label="Chọn góc ảnh">
            {views.map((viewIndex, index) => (
              <button type="button" key={viewIndex} className={view === index ? 'active' : ''} onClick={() => setView(index)} aria-pressed={view === index} aria-label={`Xem góc ảnh ${index + 1}`}>
                <img src={getViewImage(product, viewIndex)} alt="" loading="lazy" decoding="async" style={{ objectPosition: getProductPosition(product, viewIndex) }} onError={(event) => handleImgError(event, categoryImages[product.category])} />
                <span>Góc {index + 1}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="detail-info">
          <span className="p-cat">{product.categoryLabel}</span>
          <h1>{product.name}</h1>
          <div className="d-meta">
            <span className="d-rating"><Icon name="star" size={13} />{product.rating.toFixed(1)} / 5</span>
            <span>Đã bán {product.sold.toLocaleString('vi-VN')}</span>
            <span className="in-stock"><Icon name="check" size={13} strokeWidth={2.2} />Còn hàng</span>
          </div>
          <div className="d-price-row">
            <span className="d-price">{formatPrice(product.price)}</span>
            {product.oldPrice && <span className="p-old">{formatPrice(product.oldPrice)}</span>}
            {discount && <span className="p-off">Tiết kiệm {discount}%</span>}
          </div>
          <p className="d-desc">{product.description}</p>
          <ul className="d-specs">
            {product.specs.map((spec) => (
              <li key={spec}><Icon name="check" size={14} strokeWidth={2.2} />{spec}</li>
            ))}
          </ul>
          <div className="d-actions">
            <div className="qty-picker" aria-label="Số lượng">
              <button type="button" onClick={() => setQty((value) => Math.max(1, value - 1))} aria-label="Giảm số lượng"><Icon name="minus" size={15} strokeWidth={2.2} /></button>
              <span>{qty}</span>
              <button type="button" onClick={() => setQty((value) => value + 1)} aria-label="Tăng số lượng"><Icon name="plus" size={15} strokeWidth={2.2} /></button>
            </div>
            <button className="btn btn-primary" onClick={handleAdd}>
              <Icon name="cart" size={17} />
              Thêm vào giỏ · {formatPrice(product.price * qty)}
            </button>
          </div>
          <button
            className={`detail-save ${saved ? 'saved' : ''}`}
            onClick={() => { toggleSaved(product.id); showToast(saved ? 'Đã bỏ khỏi danh sách lưu' : 'Đã lưu sản phẩm để xem sau'); }}
            aria-pressed={saved}
          >
            <Icon name="bookmark" size={15} strokeWidth={saved ? 2.2 : 1.7} />
            {saved ? 'Đã lưu sản phẩm' : 'Lưu để xem sau'}
          </button>

          <ul className="d-trust" aria-label="Cam kết mua hàng">
            {trustRows.map((row) => (
              <li key={row.label}><Icon name={row.icon} size={16} />{row.label}</li>
            ))}
          </ul>

          <div className="delivery-note">
            <strong><Icon name="truck" size={16} />Giao hàng dự kiến</strong>
            <span>Nội thành TP. Hồ Chí Minh giao trong ngày · Toàn quốc gửi qua nhà xe 1 đến 3 ngày</span>
          </div>

          <div className="product-disclosures">
            <details><summary>Tình trạng và bảo quản</summary><p>Mỗi món đồ cũ được kiểm tra hoạt động và vệ sinh trước khi bán. Bảo quản đơn giản: lau khô sau khi dùng, tránh để ngoài trời mưa nắng.</p></details>
            <details><summary>Đổi trả và bảo hành</summary><p>Kiểm tra hàng tại chỗ hoặc qua video trước khi nhận. Nếu hàng không đúng mô tả, hỗ trợ đổi trong ngày hoặc hoàn tiền.</p></details>
          </div>
        </div>
      </section>
      {related.length > 0 && (
        <section className="related">
          <div className="section-head">
            <p className="eyebrow">Sản phẩm liên quan</p>
            <h2>Đồ cùng kiểu, cùng giá tốt</h2>
          </div>
          <div className="product-grid">{related.map((item) => <ProductCard key={item.id} product={item} />)}</div>
        </section>
      )}
    </main>
  );
};

export default ProductDetail;
