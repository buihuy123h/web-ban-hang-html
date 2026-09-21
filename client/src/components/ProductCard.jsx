import React from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { formatPrice } from '../utils/format';
import Icon from './Icon';
import { getProductImage, getProductPosition } from '../data/productImages';
import './ProductCard.css';

const badgeMap = { hot: 'Được chọn nhiều', sale: 'Giá tốt', new: 'Mới về' };
const badgeIcons = { hot: 'check', sale: 'spark', new: 'spark' };
const ProductCard = ({ product }) => {
  const { addToCart, showToast, toggleSaved, isSaved } = useCart();
  const saved = isSaved(product.id);
  const discount = product.oldPrice ? Math.round((1 - product.price / product.oldPrice) * 100) : null;

  const handleAdd = () => {
    addToCart(product);
    showToast(`Đã thêm “${product.name}” vào giỏ`);
  };

  const handleSave = () => {
    toggleSaved(product.id);
    showToast(saved ? 'Đã bỏ khỏi danh sách lưu' : 'Đã lưu sản phẩm để xem sau');
  };

  return (
    <article className="p-card reveal">
      <div className="p-media">
        <Link
          to={`/product/${product.id}`}
          className="p-media-link"
          style={{ backgroundImage: `url(${getProductImage(product)})`, backgroundPosition: getProductPosition(product) }}
          aria-label={`Xem chi tiết ${product.name}`}
        >
          {product.badge && (
            <span className="p-flag">
              <Icon name={badgeIcons[product.badge]} size={12} strokeWidth={2} />
              {badgeMap[product.badge]}
            </span>
          )}
          <span className="p-score">
            <Icon name="star" size={11} />
            {product.rating.toFixed(1)}
          </span>
        </Link>
        <button
          className={`p-save ${saved ? 'saved' : ''}`}
          onClick={handleSave}
          aria-pressed={saved}
          aria-label={`${saved ? 'Bỏ lưu' : 'Lưu'} ${product.name}`}
        >
          <Icon name="bookmark" size={15} strokeWidth={saved ? 2.2 : 1.7} />
        </button>
      </div>

      <div className="p-body">
        <p className="p-meta">
          <span className="p-cat">{product.categoryLabel}</span>
          <span>Đã bán {product.sold.toLocaleString('vi-VN')}</span>
        </p>
        <h3 className="p-name">
          <Link to={`/product/${product.id}`}>{product.name}</Link>
        </h3>
      </div>

      <div className="p-strip">
        <div className="p-price-row">
          <span className="p-price">{formatPrice(product.price)}</span>
          {product.oldPrice && <span className="p-old">{formatPrice(product.oldPrice)}</span>}
          {discount && <span className="p-off">−{discount}%</span>}
        </div>
        <button className="p-add" type="button" onClick={handleAdd}>
          <Icon name="cart" size={15} strokeWidth={1.9} />
          <span>Thêm vào giỏ</span>
        </button>
      </div>
    </article>
  );
};

export default ProductCard;
