import React from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { formatPrice } from '../utils/format';
import Icon from './Icon';
import { getProductImage, IMG_PLACEHOLDER, categoryImages } from '../data/productImages';
import './ProductCard.css';

const ProductCard = ({ product }) => {
  const { addToCart, showToast } = useCart();
  const discount = product.oldPrice ? Math.round((1 - product.price / product.oldPrice) * 100) : null;
  /* "Độ mới" & tồn kho mô phỏng ổn định theo id sản phẩm, giống nhãn trên thiết kế Stitch. */
  const grade = 90 + ((product.id * 7) % 9);
  const stock = Math.max(1, 5 - (product.id % 5));
  const [added, setAdded] = React.useState(false);
  const addedTimer = React.useRef(0);
  React.useEffect(() => () => window.clearTimeout(addedTimer.current), []);

  const handleAdd = () => {
    addToCart(product);
    showToast(`Đã thêm “${product.name}” vào giỏ`);
    setAdded(true);
    window.clearTimeout(addedTimer.current);
    addedTimer.current = window.setTimeout(() => setAdded(false), 1600);
  };

  return (
    <article className="sp-card">
      <Link to={`/product/${product.id}`} className="sp-media" aria-label={`Xem chi tiết ${product.name}`}>
        <img
          src={getProductImage(product)}
          alt={product.name}
          loading="lazy"
          onError={(event) => {
            const image = event.currentTarget;
            if (image.dataset.fb) image.src = IMG_PLACEHOLDER;
            else {
              image.dataset.fb = '1';
              image.src = categoryImages[product.category] || IMG_PLACEHOLDER;
            }
          }}
        />
        <div className="sp-badges">
          <span className="sp-badge sp-badge-grade"><span className="sp-dot" aria-hidden="true" />Độ mới {grade}%</span>
          <span className="sp-badge sp-badge-tag"><Icon name="verified" size={12} strokeWidth={1.9} />{product.categoryLabel}</span>
        </div>
        {discount > 0 && <span className="sp-off">−{discount}%</span>}
        <span className="sp-stock">Kho TP.HCM (Còn {stock} chiếc)</span>
      </Link>
      <div className="sp-body">
        <h3 className="sp-name"><Link to={`/product/${product.id}`}>{product.name}</Link></h3>
        <p className="sp-note"><Icon name="task" size={12} strokeWidth={1.9} />Đã kiểm tra & vệ sinh trước khi bán</p>
        <div className="sp-prices">
          <strong>{formatPrice(product.price)}</strong>
          {product.oldPrice ? <s>{formatPrice(product.oldPrice)}</s> : null}
        </div>
        <div className="sp-ctas">
          <Link to={`/product/${product.id}`} className="sp-view">Xem chi tiết</Link>
          <button type="button" className={`sp-buy${added ? ' added' : ''}`} onClick={handleAdd} aria-label={`Chốt mua ${product.name}`}>
            <Icon name={added ? 'check' : 'flash'} size={13} strokeWidth={1.9} />
            <span>{added ? 'Đã thêm' : 'Chốt mua'}</span>
          </button>
        </div>
      </div>
    </article>
  );
};

export default ProductCard;