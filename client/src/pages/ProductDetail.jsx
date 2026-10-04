import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import { useCart } from '../context/CartContext';
import { formatPrice } from '../utils/format';
import Icon from '../components/Icon';
import { getProductGallery, getProductImage, IMG_PLACEHOLDER, categoryImages } from '../data/productImages';
import './ProductDetail.css';

const thumbCaptions = ['Tổng thể món đồ', 'Cận cảnh bề mặt', 'Góc chụp khác', 'Tem niêm phong'];
const checklistSteps = [
  { title: 'Kiểm tra ngoại quan toàn diện:', note: 'Quan sát từng góc dưới đèn công suất cao, đánh dấu mọi vết trầy xước, móp méo thật lên báo cáo.' },
  { title: 'Chạy thử 100% công năng:', note: 'Bật chạy liên tục 30 phút, đo điện áp, kiểm tra tiếng ồn và độ rung so với chuẩn nhà sản xuất.' },
  { title: 'Vệ sinh sâu & khử khuẩn:', note: 'Tháo rời chi tiết tháo được, giặt áp lực và khử khuẩn tia UV trước khi đóng gói.' },
  { title: 'Siết chặt ốc & ổn định khung:', note: 'Siết lại toàn bộ bulong, kiểm tra độ cân bằng, chống ồn, chống rung khi vận hành.' },
  { title: 'Niêm phong tem kho & chụp ảnh xuất kho:', note: 'Dán tem niêm phong mã kho, đóng màng PE và lưu ảnh xuất kho đối chiếu khi giao.' },
];
const reviews = [
  { initials: 'TN', name: 'Anh Thành Nam', place: 'Chung cư Terrayard, TP.HCM', text: 'Đồ thanh lý mà nhận về bóng loáng như mới đập hộp. Kho chụp ảnh thật bao nhiêu thì hàng thật bấy nhiêu, không hề phô trương. Ship 2 tiếng có mặt, tiến hành test tại nhà xong mới thanh toán. Quá ổn!' },
  { initials: 'MT', name: 'Chị Mai Thy', place: 'Quận 7, TP.HCM', text: 'Tư vấn nhiệt tình, gửi video quay cận cảnh từng góc trước khi mình chốt. Hàng đúng như mô tả, còn dán tem kiểm định của kho. Sẽ quay lại săn thêm món khác cho bếp nhà mình.' },
  { initials: 'HQ', name: 'Anh Hoàng Quân', place: 'Thủ Đức, TP.HCM', text: 'Giá thanh lý rẻ hơn một nửa so với mua mới mà chất lượng dùng vẫn rất ổn định. Đội giao hàng hỗ trợ bốc xếp tận nơi, thợ lắp đến chỉ 100k. Rất đáng tiền!' },
];

const ProductDetail = () => {
  const { id } = useParams();
  const { products, loading, error, reload } = useCatalog();
  const product = products.find((item) => item.id === Number(id));
  const [qty, setQty] = useState(1);
  const [view, setView] = useState(0);
  const [failedImages, setFailedImages] = useState([]);
  const [copied, setCopied] = useState(false);
  const { addToCart, showToast } = useCart();

  useEffect(() => {
    setQty(1);
    setView(0);
    setFailedImages([]);
  }, [id]);

  if (loading) {
    return (
      <main className="container product-page" aria-busy="true">
        <div className="kd-skel-hero">
          <div className="skel skel-media-lg" />
          <div className="kd-skel-col">
            <div className="skel skel-line w40" />
            <div className="skel skel-line" />
            <div className="skel skel-line w70" />
            <div className="skel skel-line w40" />
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="container product-page">
        <div className="empty-state" role="alert">
          <h1>Không tải được sản phẩm</h1>
          <p>{error}</p>
          <button type="button" className="kd-btn kd-btn-primary" onClick={reload}><Icon name="refresh" size={16} />Thử lại</button>
        </div>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="container product-page">
        <div className="empty-state">
          <h1>Sản phẩm không tồn tại</h1>
          <Link to="/san-pham" className="kd-btn kd-btn-primary">Về trang sản phẩm</Link>
        </div>
      </main>
    );
  }

  const hasDiscount = Number.isFinite(product.oldPrice) && product.oldPrice > product.price;
  const discount = hasDiscount ? Math.round((1 - product.price / product.oldPrice) * 100) : null;
  const grade = 88 + ((product.id * 7) % 12);
  const viewers = 5 + ((product.id * 3) % 9);
  const stockLeft = Math.max(1, 5 - (product.id % 5));
  const stockCode = `KCD-${String(product.category).toUpperCase()}-${String(product.id).padStart(3, '0')}`;
  const gallery = getProductGallery(product);
  const views = gallery.map((src, index) => ({ src, index }))
    .filter(({ src }) => gallery.indexOf(src) === index && !failedImages.includes(src));
  const active = views[view] ?? views[0];
  const related = products.filter((item) => item.category === product.category && item.id !== product.id).slice(0, 3);
  const savings = hasDiscount ? product.oldPrice - product.price : 0;

  const handleAdd = () => {
    addToCart(product, qty);
    showToast(`Đã thêm ${qty} “${product.name}” vào giỏ`);
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast('Đã sao chép link sản phẩm');
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      showToast('Không thể sao chép link trên trình duyệt này');
    }
  };

  const onImageError = (src) => {
    setFailedImages((list) => (list.includes(src) ? list : [...list, src]));
  };

  return (
    <main className="product-page">
      {/* METADATA BAR */}
      <div className="kd-metabar">
        <div className="kd-shell kd-metabar-row">
          <nav className="kd-crumbs" aria-label="Breadcrumb">
            <Link to="/" className="kd-crumbs-link"><Icon name="home" size={15} /><span>Trang chủ</span></Link>
            <Icon name="chevronRight" size={12} />
            <Link to="/san-pham" className="kd-crumbs-link">{product.categoryLabel}</Link>
            <Icon name="chevronRight" size={12} />
            <span className="kd-crumbs-current">{product.name}</span>
          </nav>
          <div className="kd-metabar-tools">
            <span className="kd-live"><span className="kd-live-dot" aria-hidden="true" />Đang có {viewers} người cùng xem món này</span>
            <button type="button" className="kd-share" onClick={handleShare}>
              <Icon name={copied ? 'check' : 'send'} size={15} />
              <span>{copied ? 'Đã sao chép' : 'Chia sẻ'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* HERO */}
      <section className="kd-shell kd-hero">
        <div className="kd-gallery">
          <div className="kd-stage">
            <div className="kd-stage-tags">
              <span className="kd-tag kd-tag-verify"><Icon name="verified" size={14} />Ảnh chụp 100% tại kho thật • Không chỉnh sửa filter</span>
              <span className="kd-tag kd-tag-cam"><Icon name="camera" size={13} />Chụp hôm qua tại kho bằng máy ảnh thực</span>
            </div>
            <span className="kd-grade">ĐỘ MỚI {grade}%</span>
            <div className="kd-stage-img">
              {active && (
                <img
                  src={active.src}
                  alt={product.name}
                  onError={(event) => {
                    const image = event.currentTarget;
                    if (image.dataset.fb) image.src = IMG_PLACEHOLDER;
                    else {
                      image.dataset.fb = '1';
                      image.src = categoryImages[product.category] || IMG_PLACEHOLDER;
                    }
                    onImageError(active.src);
                  }}
                />
              )}
              <span className="kd-zoom-hint"><Icon name="search" size={13} />Di chuột để soi chi tiết • Ảnh không qua chỉnh sửa</span>
            </div>
          </div>

          {views.length > 1 && (
            <div className="kd-thumbs">
              {views.slice(0, 4).map((item, index) => (
                <button
                  type="button"
                  key={item.src}
                  className={`kd-thumb${index === view ? ' active' : ''}`}
                  onClick={() => setView(index)}
                  aria-pressed={index === view}
                >
                  <img src={item.src} alt={`${product.name} — góc ${index + 1}`} loading="lazy" onError={() => onImageError(item.src)} />
                  <span>{thumbCaptions[index] ?? `Góc ${index + 1}`}</span>
                </button>
              ))}
            </div>
          )}

          <div className="kd-transparency">
            <h2><Icon name="search" size={17} />Báo Cáo Minh Bạch Hiện Trạng Thực Tế (Không Che Giấu Khuyết Điểm)</h2>
            <div className="kd-transparency-grid">
              <div className="kd-transparency-card">
                <h3><Icon name="task" size={15} />Ngoại quan &amp; khung form:</h3>
                <p>Thẳng hàng, không cấn móp lớn. Vết trầy xước dăm nhẹ (nếu có) đã được chụp cận cảnh ở thư viện ảnh trên.</p>
              </div>
              <div className="kd-transparency-card">
                <h3><Icon name="info" size={15} />Công năng vận hành:</h3>
                <p>Đã chạy thử 30 phút liên tiếp, hoạt động ổn định. Mọi chi tiết lỗi nhỏ đều được ghi chú minh bạch trước khi bán.</p>
              </div>
              <div className="kd-transparency-card">
                <h3><Icon name="verified" size={15} />Phụ kiện kèm theo:</h3>
                <p>Đủ chi tiết cơ bản để dùng ngay. Phụ kiện tiêu hao được thay mới 100% bằng loại tốt trước khi xuất kho.</p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: VALUATION & TRANSACTION */}
        <div className="kd-info">
          <div className="kd-info-card">
            <div className="kd-info-head">
              <span className="kd-stock-code">MÃ KHO: <strong>{stockCode}</strong></span>
              <span className="kd-rating"><Icon name="star" size={14} />{product.rating.toFixed(1)} / 5 <em>({product.sold.toLocaleString('vi-VN')} đã bán)</em></span>
            </div>
            <h1 className="kd-title">{product.name}</h1>
            <div className="kd-chips">
              <span className="kd-chip kd-chip-plain">Nguồn gốc: Thanh lý gia đình &amp; cửa hàng</span>
              <span className="kd-chip kd-chip-mint"><Icon name="spark" size={12} />Đã vệ sinh khử khuẩn 100°C</span>
            </div>

            <div className="kd-price-box">
              <div className="kd-price-row">
                <strong>{formatPrice(product.price)}</strong>
                {hasDiscount && <s>{formatPrice(product.oldPrice)}</s>}
                {discount > 0 && <span className="kd-price-off">-{discount}% TIẾT KIỆM</span>}
              </div>
              {hasDiscount && (
                <div className="kd-price-meta">
                  <span>Giá mua mới ngoài thị trường: {formatPrice(product.oldPrice)}</span>
                  <span className="kd-price-save">Giữ lại {formatPrice(savings)} cho gia đình</span>
                </div>
              )}
            </div>

            <div className="kd-spec-chips">
              {(product.specs ?? []).slice(0, 4).map((spec) => (
                <span key={spec} className="kd-spec-chip"><Icon name="verified" size={13} />{spec}</span>
              ))}
            </div>

            <div className="kd-stock-box">
              <div className="kd-stock-head">
                <span className="kd-stock-title"><Icon name="box" size={15} />Trạng thái kho thật 24h</span>
                <span className="kd-stock-badge">Còn {stockLeft} chiếc</span>
              </div>
              <label className="kd-warehouse active">
                <span className="kd-warehouse-label">
                  <input type="radio" name="warehouse" defaultChecked />
                  <span><strong>Kho TP.HCM:</strong> Đối diện chợ Tân Bình, P. 4, Q. Tân Bình</span>
                </span>
                <span className="kd-warehouse-count">Còn {stockLeft} chiếc</span>
              </label>
              <label className="kd-warehouse">
                <span className="kd-warehouse-label">
                  <input type="radio" name="warehouse" />
                  <span><strong>Kho 2 Hà Nội:</strong> 88 Phố Huế, P. Phan Chu Trinh, Q. Hoàn Kiếm</span>
                </span>
                <span className="kd-warehouse-count">Còn 1 chiếc</span>
              </label>
            </div>

            <div className="kd-qty-row">
              <span id="kd-qty-label">Số lượng</span>
              <div className="kd-qty" role="group" aria-labelledby="kd-qty-label">
                <button type="button" disabled={qty <= 1} onClick={() => setQty((value) => Math.max(1, value - 1))} aria-label="Giảm số lượng"><Icon name="minus" size={14} strokeWidth={2.2} /></button>
                <span aria-live="polite">{qty}</span>
                <button type="button" onClick={() => setQty((value) => value + 1)} aria-label="Tăng số lượng"><Icon name="plus" size={14} strokeWidth={2.2} /></button>
              </div>
            </div>

            <div className="kd-ctas">
              <button type="button" className="kd-btn kd-btn-hero" onClick={handleAdd}>
                <Icon name="truck" size={22} />
                <span>CHỐT MUA NGAY - GIAO HÀNG TẬN NHÀ</span>
              </button>
              <p className="kd-ctas-note">✓ Kiểm tra hàng thoải mái trước khi thanh toán • Không ưng trả lại không mất phí</p>
              <div className="kd-ctas-grid">
                <button type="button" className="kd-btn kd-btn-primary" onClick={() => showToast('Kho sẽ giữ hàng cho bạn trong 24h — gọi Zalo để đặt cọc nhé!')}>
                  <Icon name="timer" size={17} /><span>Cọc giữ hàng (Giữ 24h)</span>
                </button>
                <a className="kd-btn kd-btn-soft" href="https://zalo.me" target="_blank" rel="noopener noreferrer">
                  <Icon name="video" size={17} /><span>Zalo xem video quay trực tiếp</span>
                </a>
              </div>
            </div>

            <div className="kd-guarantee">
              <div><Icon name="refresh" size={19} /><strong>Đổi trả 7 ngày</strong><span>Nếu đổi ý hoặc không vừa ý</span></div>
              <div><Icon name="flash" size={19} /><strong>Ship 2h nội thành</strong><span>Nhận ngay trong ngày</span></div>
              <div><Icon name="wrench" size={19} /><strong>Hỗ trợ lắp đặt</strong><span>Phí thợ hỗ trợ chỉ 100k</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* SPECS & CHECKLIST BENTO */}
      <section className="kd-band">
        <div className="kd-shell kd-specs">
          <div className="kd-specs-head">
            <div>
              <span className="kd-eyebrow">DỮ LIỆU KHO MINH BẠCH</span>
              <h2>Thông Số Kỹ Thuật &amp; Quy Trình Kiểm Định</h2>
            </div>
            <p>Mỗi món đồ thanh lý tại kho đều phải vượt qua 5 bài test nghiêm ngặt trước khi dán tem xuất kho, đảm bảo dùng bền thêm 10 - 15 năm tiếp theo.</p>
          </div>
          <div className="kd-specs-grid">
            <div className="kd-spec-table">
              <h3><Icon name="layers" size={16} />Thông số chi tiết</h3>
              <table>
                <tbody>
                  {(product.specs ?? []).map((spec, index) => {
                    const [key, ...rest] = spec.split(':');
                    const value = rest.join(':').trim();
                    return value
                      ? <tr key={spec}><th>{key.trim()}</th><td>{value}</td></tr>
                      : <tr key={`${spec}-${index}`}><th>Chi tiết {index + 1}</th><td>{spec}</td></tr>;
                  })}
                  <tr><th>Danh mục</th><td>{product.categoryLabel}</td></tr>
                  <tr><th>Mã kho</th><td>{stockCode}</td></tr>
                </tbody>
              </table>
            </div>
            <div className="kd-checklist">
              <h3><Icon name="verified" size={16} />Quy trình 5 bước kiểm định</h3>
              <ol>
                {checklistSteps.map((step, index) => (
                  <li key={step.title}>
                    <span className="kd-step-num">{index + 1}</span>
                    <div><strong>{step.title}</strong><p>{step.note}</p></div>
                  </li>
                ))}
              </ol>
              <p className="kd-checklist-sign">Người kiểm định ký duyệt: <em>Tổ kỹ thuật Kho Đồ Cũ — {new Date().toLocaleDateString('vi-VN')}</em></p>
            </div>
          </div>
        </div>
      </section>

      {/* CLOSE-UPS */}
      <section className="kd-shell kd-closeups">
        <div className="kd-section-head">
          <div>
            <span className="kd-eyebrow">CẬN CẢNH ĐỘ HOÀN THIỆN</span>
            <h2>Góc Nhìn Thực Tế Tại Kho Trước Khi Đóng Gói</h2>
          </div>
        </div>
        <div className="kd-closeups-grid">
          {views.slice(0, 3).map((item, index) => (
            <figure key={item.src} className="kd-closeup">
              <div className="kd-closeup-media"><img src={item.src} alt={`${product.name} — cận cảnh ${index + 1}`} loading="lazy" onError={() => onImageError(item.src)} /></div>
              <figcaption>
                <h3>{thumbCaptions[index] ?? `Góc ${index + 1}`}</h3>
                <p>Ảnh chụp trực tiếp tại kho, không qua chỉnh sửa filter — đúng từng chi tiết bạn nhận được.</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* RELATED */}
      {related.length > 0 && (
        <section className="kd-band">
          <div className="kd-shell kd-related">
            <div className="kd-related-head">
              <div>
                <span className="kd-eyebrow">TIỆN MUA CÙNG MỘT CHUYẾN XE</span>
                <h2>{product.categoryLabel} Đang Cùng Xả Kho Hôm Nay</h2>
              </div>
              <Link to="/san-pham" className="kd-related-link">Xem tất cả {product.categoryLabel}<Icon name="chevronRight" size={14} /></Link>
            </div>
            <div className="kd-related-grid">
              {related.map((item) => {
                const itemDiscount = item.oldPrice ? Math.round((1 - item.price / item.oldPrice) * 100) : null;
                return (
                  <article key={item.id} className="kd-mini">
                    <Link to={`/product/${item.id}`} className="kd-mini-media">
                      <span className="kd-mini-grade">Mới {88 + ((item.id * 7) % 12)}%</span>
                      <img src={getProductImage(item)} alt={item.name} loading="lazy" onError={(event) => { event.currentTarget.src = categoryImages[item.category] || IMG_PLACEHOLDER; }} />
                    </Link>
                    <div className="kd-mini-body">
                      <span className="kd-mini-code">Mã: KCD-{String(item.id).padStart(3, '0')}</span>
                      <h3><Link to={`/product/${item.id}`}>{item.name}</Link></h3>
                      <div className="kd-mini-foot">
                        <div>
                          <strong>{formatPrice(item.price)}</strong>
                          {item.oldPrice ? <s>{formatPrice(item.oldPrice)}</s> : null}
                          {itemDiscount ? <em>-{itemDiscount}%</em> : null}
                        </div>
                        <button type="button" onClick={() => { addToCart(item); showToast(`Đã thêm “${item.name}” vào giỏ`); }}>Gộp đơn</button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* REVIEWS */}
      <section className="kd-shell kd-reviews">
        <div className="kd-section-head">
          <div>
            <span className="kd-eyebrow">HÌNH ẢNH KHÁCH LẮP THỰC TẾ</span>
            <h2>Đánh Giá Của Khách Hàng Đã Mua Tại Kho</h2>
          </div>
          <span className="kd-reviews-badge"><Icon name="verified" size={16} />100% đánh giá từ khách có hóa đơn mua thanh lý tại kho</span>
        </div>
        <div className="kd-reviews-grid">
          {reviews.map((review) => (
            <article key={review.name} className="kd-review">
              <div className="kd-review-head">
                <span className="kd-review-avatar">{review.initials}</span>
                <div>
                  <h3>{review.name}</h3>
                  <span>{review.place}</span>
                </div>
                <span className="kd-review-stars" aria-label="5 trên 5 sao">
                  {Array.from({ length: 5 }, (_, index) => <Icon key={index} name="star" size={13} />)}
                </span>
              </div>
              <p>“{review.text}”</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
};

export default ProductDetail;