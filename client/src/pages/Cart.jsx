import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { formatPrice } from '../utils/format';
import { createOrder } from '../api/orders';
import Icon from '../components/Icon';
import heroImage from '../assets/inox-editorial-hero.png';
import '../App.css';
import './Cart.css';

const Cart = () => {
  const { items, updateQty, removeFromCart, clearCart, cartCount, cartTotal, showToast } = useCart();
  const [placed, setPlaced] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [orderCode, setOrderCode] = useState('');
  const [delivery, setDelivery] = useState('standard');
  const [payment, setPayment] = useState('cod');
  const [promo, setPromo] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', address: '', note: '' });
  const [errors, setErrors] = useState({});
  const navigate = useNavigate();

  const shipping = delivery === 'express' ? 45000 : (cartTotal >= 500000 ? 0 : 30000);
  const discount = promoApplied ? Math.round(cartTotal * 0.1) : 0;
  const grandTotal = Math.max(0, cartTotal + shipping - discount);

  const setField = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const validate = () => {
    const next = {};
    if (form.name.trim().length < 2) next.name = 'Nhập họ tên người nhận.';
    if (!/^0\d{9}$/.test(form.phone.trim())) next.phone = 'Số điện thoại cần 10 số và bắt đầu bằng 0.';
    if (form.address.trim().length < 10) next.address = 'Nhập địa chỉ giao hàng đầy đủ hơn.';
    return next;
  };

  const applyPromo = () => {
    if (promo.trim().toUpperCase() === 'QUANGHUY10') {
      setPromoApplied(true);
      showToast('Đã áp dụng mã QUANGHUY10');
    } else {
      setPromoApplied(false);
      showToast('Mã ưu đãi chưa đúng hoặc đã hết hiệu lực');
    }
  };

  const handleOrder = async (event) => {
    event.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length) {
      requestAnimationFrame(() => document.querySelector('.form-grid [aria-invalid="true"]')?.focus());
      return;
    }
    setSubmitting(true);
    try {
      // Backend kiểm tra dữ liệu và tính lại tiền theo giá chuẩn từ server.
      const { order } = await createOrder({
        items: items.map(({ id, qty }) => ({ id, qty })),
        delivery,
        payment,
        promoCode: promoApplied ? 'QUANGHUY10' : '',
        customer: { name: form.name, phone: form.phone, address: form.address, note: form.note },
      });
      setOrderCode(order.code);
      setPlaced(true);
      clearCart();
      showToast('Đơn hàng đã được ghi nhận.');
    } catch (err) {
      showToast(err.message || 'Không gửi được đơn hàng, vui lòng thử lại.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const itemPositions = useMemo(() => ['72% center', '92% 54%', '46% 60%'], []);

  if (placed) {
    return (
      <main className="container">
        <section className="order-success">
          <span className="success-mark"><Icon name="check" size={22} strokeWidth={2.4} /></span>
          <p className="order-reference">Mã đơn hàng {orderCode}</p>
          <h1>Đơn hàng đã được ghi nhận.</h1>
          <p>Cảm ơn {form.name}. Chúng tôi sẽ liên hệ qua số {form.phone} để xác nhận giao hàng.</p>
          <div className="success-actions">
            <button className="btn btn-primary" onClick={() => { setPlaced(false); navigate('/'); }}>Tiếp tục mua sắm</button>
            <Link to="/contact" className="btn btn-outline">Cần hỗ trợ</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="container">
      <div className="cart-heading">
        <div>
          <p className="eyebrow">Thanh toán</p>
          <h1>Giỏ hàng</h1>
        </div>
        <span>{cartCount} sản phẩm</span>
      </div>
      {items.length === 0 ? (
        <div className="empty-state">
          <h3>Giỏ hàng đang trống</h3>
          <p>Khám phá đồ cũ thanh lý còn dùng tốt — ghế nhựa, kệ inox, giường tầng và nhiều món khác.</p>
          <Link to="/" className="btn btn-primary"><Icon name="cart" size={17} />Xem sản phẩm</Link>
        </div>
      ) : (
        <form className="checkout-form" onSubmit={handleOrder} noValidate>
          <div className="checkout-main">
            <section className="panel cart-list" aria-labelledby="cart-items-title">
              <h2 id="cart-items-title">Sản phẩm</h2>
              {items.map((item, index) => (
                <article className="cart-item" key={item.id}>
                  <img className="ci-thumb" src={heroImage} alt="" style={{ objectPosition: itemPositions[index % itemPositions.length] }} />
                  <div className="ci-info">
                    <Link to={`/product/${item.id}`} className="ci-name">{item.name}</Link>
                    <div className="ci-price">{formatPrice(item.price)}</div>
                  </div>
                  <div className="qty-picker">
                    <button type="button" onClick={() => updateQty(item.id, -1)} aria-label="Giảm số lượng"><Icon name="minus" size={14} strokeWidth={2.2} /></button>
                    <span>{item.qty}</span>
                    <button type="button" onClick={() => updateQty(item.id, 1)} aria-label="Tăng số lượng"><Icon name="plus" size={14} strokeWidth={2.2} /></button>
                  </div>
                  <div className="ci-total">{formatPrice(item.price * item.qty)}</div>
                  <button type="button" className="ci-remove" aria-label={`Xóa ${item.name}`} onClick={() => { removeFromCart(item.id); showToast('Đã xóa sản phẩm khỏi giỏ'); }}>
                    <Icon name="close" size={13} strokeWidth={2.2} />
                    <span>Xóa</span>
                  </button>
                </article>
              ))}
              <button type="button" className="clear-btn" onClick={() => { clearCart(); showToast('Đã xóa toàn bộ giỏ hàng'); }}>Xóa toàn bộ giỏ hàng</button>
            </section>

            <section className="panel checkout-section" aria-labelledby="delivery-title">
              <div className="checkout-section-head">
                <h2 id="delivery-title">Thông tin giao hàng</h2>
                <span>Bắt buộc</span>
              </div>
              <div className="form-grid">
                <label>Họ và tên<input type="text" value={form.name} onChange={setField('name')} autoComplete="name" aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'checkout-name-error' : undefined} />{errors.name && <em id="checkout-name-error">{errors.name}</em>}</label>
                <label>Số điện thoại<input type="tel" value={form.phone} onChange={setField('phone')} autoComplete="tel" inputMode="numeric" aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? 'checkout-phone-error' : undefined} />{errors.phone && <em id="checkout-phone-error">{errors.phone}</em>}</label>
                <label className="full">Địa chỉ giao hàng<input type="text" value={form.address} onChange={setField('address')} autoComplete="street-address" aria-invalid={Boolean(errors.address)} aria-describedby={errors.address ? 'checkout-address-error' : undefined} />{errors.address && <em id="checkout-address-error">{errors.address}</em>}</label>
                <label className="full">Ghi chú cho đơn hàng<textarea rows="3" value={form.note} onChange={setField('note')} placeholder="Ví dụ: gọi trước khi giao" /></label>
              </div>
            </section>

            <section className="panel checkout-section" aria-labelledby="payment-title">
              <div className="checkout-section-head">
                <h2 id="payment-title">Giao nhận và thanh toán</h2>
              </div>
              <div className="option-list">
                <label className={delivery === 'standard' ? 'selected' : ''}>
                  <input type="radio" name="delivery" value="standard" checked={delivery === 'standard'} onChange={(event) => setDelivery(event.target.value)} />
                  <span className="opt-check"><Icon name="check" size={12} strokeWidth={2.6} /></span>
                  <span><strong>Giao tiêu chuẩn</strong><small>2 đến 4 ngày làm việc</small></span>
                  <b>{cartTotal >= 500000 ? 'Miễn phí' : formatPrice(30000)}</b>
                </label>
                <label className={delivery === 'express' ? 'selected' : ''}>
                  <input type="radio" name="delivery" value="express" checked={delivery === 'express'} onChange={(event) => setDelivery(event.target.value)} />
                  <span className="opt-check"><Icon name="check" size={12} strokeWidth={2.6} /></span>
                  <span><strong>Giao nhanh nội thành</strong><small>Trong vòng 2 giờ</small></span>
                  <b>{formatPrice(45000)}</b>
                </label>
              </div>
              <div className="payment-options">
                <label><input type="radio" name="payment" value="cod" checked={payment === 'cod'} onChange={(event) => setPayment(event.target.value)} />Thanh toán khi nhận hàng</label>
                <label><input type="radio" name="payment" value="transfer" checked={payment === 'transfer'} onChange={(event) => setPayment(event.target.value)} />Chuyển khoản ngân hàng</label>
              </div>
            </section>
          </div>

          <aside className="cart-summary" aria-label="Tóm tắt đơn hàng">
            <h2>Tóm tắt đơn hàng</h2>
            <div className="promo-field">
              <input value={promo} onChange={(event) => { setPromo(event.target.value); setPromoApplied(false); }} placeholder="Mã ưu đãi" aria-label="Mã ưu đãi" autoComplete="off" />
              <button type="button" onClick={applyPromo}>Áp dụng</button>
            </div>
            {promoApplied && <p className="promo-success"><Icon name="check" size={13} strokeWidth={2.4} />Mã QUANGHUY10 đang được áp dụng.</p>}
            <div className="sum-row"><span>Tạm tính</span><span>{formatPrice(cartTotal)}</span></div>
            <div className="sum-row"><span>Vận chuyển</span><span>{shipping === 0 ? 'Miễn phí' : formatPrice(shipping)}</span></div>
            {discount > 0 && <div className="sum-row discount"><span>Ưu đãi</span><span>−{formatPrice(discount)}</span></div>}
            <div className="sum-row total"><span>Tổng cộng</span><span>{formatPrice(grandTotal)}</span></div>
            <button className="btn btn-olive btn-block" type="submit" disabled={submitting}>
              {submitting
                ? <span className="btn-spin" aria-hidden="true" />
                : <Icon name="cart" size={17} />}
              {submitting ? 'Đang ghi nhận đơn…' : 'Xác nhận đặt hàng'}
            </button>
            <p className="checkout-assurance"><Icon name="shield" size={13} />Thông tin chỉ được dùng để xử lý và giao đơn hàng này.</p>
            <Link to="/" className="continue-link">Tiếp tục mua sắm</Link>
          </aside>
        </form>
      )}
    </main>
  );
};

export default Cart;