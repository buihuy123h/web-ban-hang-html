import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import { useCart } from '../context/CartContext';
import ProductCard from '../components/ProductCard';
import Icon from '../components/Icon';
import { categoryImages, HERO_IMAGE, resolveImg } from '../data/productImages';
import '../App.css';
import './Home.css';

const benefits = [['verified', 'Tuyển chọn kỹ lưỡng', 'Hàng được kiểm tra trước khi đăng bán.'], ['shield', 'Đã vệ sinh & khử trùng', 'Sạch sẽ, dùng được ngay tại nhà.'], ['spark', 'Mức giá hợp lý', 'Tiết kiệm hơn so với mua mới.'], ['truck', 'Giao hàng tận nơi', 'Hỏi shop cách gửi phù hợp từng món.']];

const CategorySlider = ({ children }) => {
  const trackRef = useRef(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const update = () => {
    const el = trackRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };
  useEffect(() => {
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [children]);
  const scroll = (dir) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth, behavior: 'smooth' });
  };
  return (
    <div className="hcp-slider">
      <div className="hcp-track" ref={trackRef} onScroll={update}>{children}</div>
      <button type="button" className="hcp-nav hcp-nav-prev" onClick={() => scroll(-1)} disabled={!canPrev} aria-label="Xem sản phẩm phía trước"><Icon name="chevronLeft" size={16} /></button>
      <button type="button" className="hcp-nav hcp-nav-next" onClick={() => scroll(1)} disabled={!canNext} aria-label="Xem sản phẩm tiếp theo"><Icon name="chevronRight" size={16} /></button>
    </div>
  );
};

const Home = () => {
  const { products, categories, loading, error, reload } = useCatalog();
  const { showToast } = useCart();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('');
  const featured = useMemo(() => products.filter((p) => p.badge === 'hot').slice(0, 4), [products]);
  const categoryBlocks = useMemo(() => categories.filter((c) => c.key !== 'all').map((category) => ({ ...category, products: products.filter((p) => p.category === category.key).slice(0, 8) })).filter((c) => c.products.length), [categories, products]);
  const search = (event) => { event.preventDefault(); const params = new URLSearchParams(); if (query.trim()) params.set('q', query.trim()); if (cat) params.set('cat', cat); navigate(`/san-pham${params.toString() ? `?${params}` : ''}`); };
  const copyCode = async () => { try { await navigator.clipboard.writeText('QUANGHUY10'); } catch { /* unavailable */ } showToast('Đã sao chép mã QUANGHUY10'); };

  return <main className="home-page">
    <section className="home-hero"><div className="home-hero-copy"><span className="home-kicker">ĐỒ CŨ QUANG HUY · THANH LÝ 50–70%</span><h1>KHO TỔNG XẢ SALE &<br /><em>THANH LÝ ĐỒ CŨ, NỘI THẤT,<br />ĐỒ DÙNG GIA ĐÌNH</em></h1><p>Hàng ngàn món đồ nội thất, gia dụng và đồ dùng quán xá đã qua sử dụng nhưng vẫn còn tốt, được chọn lọc với mức giá hợp lý.</p><form className="home-search" onSubmit={search}><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Bạn đang tìm món gì?" aria-label="Tìm sản phẩm" /><select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Chọn danh mục"><option value="">Tất cả danh mục</option>{categories.filter((c) => c.key !== 'all').map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select><button type="submit"><Icon name="search" size={16} /> Tìm kiếm</button></form><div className="hero-ctas"><Link className="hero-cta-main" to="/san-pham">Xem Đồ Đang Bán Ngay <span aria-hidden="true">→</span></Link><Link className="hero-cta-ghost" to="/lien-he">Đăng Bán / Thanh Lý Nội Thất Cũ</Link></div><div className="hero-stats"><div><b>500+</b><span>Món đồ cập nhật liên tục</span></div><div><b>1.200+</b><span>Nguồn hàng ổn định quanh năm</span></div><div><b>24H</b><span>Xử lý &amp; đăng bán nhanh</span></div><div><b>63</b><span>Tỉnh thành nhận giao hàng</span></div></div></div><div className="home-hero-image"><img src={resolveImg(HERO_IMAGE)} alt="Không gian đồ nội thất thanh lý" /><div className="hero-price">Xem từ<br /><b>185.000đ</b></div><div className="hero-range">Đa dạng mức giá từ 85K – 1 TRIỆU+</div></div><div className="hero-caption-card"><div className="hero-caption-copy"><b>Combo Bàn Ăn Gỗ Tự Nhiên &amp; Bộ Ghế Kha Xinh</b><small>Đẹp bền, giá tốt — chọn được món ưng ý ngay hôm nay.</small></div><Link className="hero-caption-btn" to="/san-pham">Xem chi tiết</Link></div></section>
    <section className="home-section selection"><div className="home-section-head"><div><small>DANH MỤC ĐỒ CŨ CHỌN LỌC</small><h2>Tuyển Chọn Đồ Dùng Gia Đình Giá Sốc</h2></div><p>Đồ dùng được lựa chọn kỹ lưỡng, làm sạch và đăng tải rõ ràng tình trạng.</p></div><div className="category-grid">{categoryBlocks.slice(0, 6).map((category) => <Link className="category-card" to={`/san-pham?cat=${category.key}`} key={category.key}><img src={resolveImg(categoryImages[category.key] || category.products[0]?.image)} alt={category.label} /><strong>{category.label}</strong><small>{category.products.length} sản phẩm đang có <span>→</span></small></Link>)}</div><div className="home-more-row"><Link className="home-more" to="/san-pham">Xem đủ danh mục đang mở bán →</Link></div></section>
    <section className="benefit-band"><div className="home-section-head centered"><div><small>ĐIỀU KHÁC BIỆT CỦA ĐỒ CŨ QUANG HUY</small><h2>Quy Trình 4 Bước Kiểm Định Vàng</h2></div><p>Chúng tôi kiểm tra nghiêm ngặt trước khi đưa món đồ đến tay khách hàng.</p></div><div className="benefit-grid">{benefits.map(([icon, title, text], index) => <article key={title}><span className="benefit-icon"><Icon name={icon} size={16} /></span><small>BƯỚC 0{index + 1}</small><h3>{title}</h3><p>{text}</p><b>✓ Cam kết từ Đồ Cũ Quang Huy</b></article>)}</div></section>
    <section className="home-section featured-home"><div className="home-section-head"><div><small>HÀNG MỚI CÓ HÀNG · GIÁ FLASH SALE TRONG NGÀY</small><h2>Hàng Mới Lên Kệ & Flash Sale Trong Ngày</h2></div><Link className="home-outline" to="/san-pham">Xem tất cả sản phẩm →</Link></div>{error ? <div className="home-error">{error} <button onClick={reload}>Thử lại</button></div> : loading ? <div className="home-loading">Đang tải sản phẩm...</div> : <div className="featured-grid">{(featured.length ? featured : products.slice(0, 4)).map((p) => <ProductCard key={p.id} product={p} />)}</div>}<div className="home-more-row"><Link className="home-more" to="/san-pham">Xem thêm 150+ món mới mỗi ngày →</Link></div></section>
    <section className="home-section cat-products" aria-label="Sản phẩm theo danh mục"><div className="home-section-head centered"><div><small>NGHE KỸ LÀ MUA ĐÚNG — Duyệt theo từng nhóm đồ</small><h2>Sản Phẩm Của Từng Danh Mục Đang Bán</h2></div><p>Mỗi danh mục đều có hàng chọn lọc riêng — bấm "Xem tất cả" để duyệt trọn bộ món đang có trong kho.</p></div>{loading ? <div className="home-loading">Đang tải sản phẩm...</div> : error ? <div className="home-error">{error} <button onClick={reload}>Thử lại</button></div> : categoryBlocks.map((category) => <div className="hcp-block" key={category.key}><header className="hcp-head"><span className="hcp-icon"><Icon name="grid" size={16} /></span><div><h3>{category.label}</h3><small>{category.products.length} món tiêu biểu · cập nhật hôm nay</small></div><Link className="hcp-link" to={`/san-pham?cat=${category.key}`}>Xem tất cả {category.label}<span aria-hidden="true">→</span></Link></header><CategorySlider>{category.products.map((product) => <ProductCard key={product.id} product={product} />)}</CategorySlider></div>)}{!loading && !error && <div className="home-more-row"><Link className="home-more" to="/san-pham">Duyệt toàn bộ kho — hơn 500 món đang mở bán →</Link></div>}</section>
    <section className="home-cta"><div><small>ĐỒ CŨ VẪN CÓ THỂ ĐẸP</small><h2>Bạn Cần Thanh Lý Đồ Nội Thất,<br />Tiết Kiệm Giá Đúng, Đồ Món Hoặc Trọn Gói Gia Đình?</h2><p>Đừng để món đồ cũ nằm im — hãy để chúng tôi giúp bạn tìm người cần nó.</p><div className="cta-points"><span>● Báo giá tại chỗ</span><span>● Đăng bán đơn giản</span><span>● Thanh toán linh hoạt</span></div></div><div className="promo-card"><small>GỬI ẢNH ĐỂ NHẬN GIÁ NHANH</small><h3>Đăng bán đồ cũ của bạn</h3><p>Chụp ảnh món đồ và gửi cho shop, chúng tôi sẽ tư vấn trong ngày.</p><button onClick={copyCode}>Nhận tư vấn ngay →</button></div></section>
    <section className="home-section stories"><div className="home-section-head centered"><div><small>THẬT HƠN TỪ NHỮNG GÌ CHÚNG TÔI BÁN</small><h2>Khách Hàng Nói Gì Về Kho Chúng Tôi?</h2></div></div><div className="story-grid">{[{ q: '“Món đồ đúng như hình, shop tư vấn rất nhiệt tình và giao hàng nhanh.”', n: 'Nguyễn Lan' }, { q: '“Giá hợp lý, hàng đã vệ sinh sạch sẽ. Sẽ quay lại mua thêm.”', n: 'Trần Minh' }, { q: '“Tìm được đúng chiếc bàn cần cho căn hộ, chất lượng vượt mong đợi.”', n: 'Hoàng Mai' }].map((t, i) => <article key={t.q}><img src={resolveImg(products[i]?.image || HERO_IMAGE)} alt="Khách hàng và sản phẩm" /><div className="story-body"><span className="story-stars" aria-label="Đánh giá 5 trên 5 sao">★★★★★</span><p>{t.q}</p><span className="story-who"><b className="story-avatar" aria-hidden="true">{t.n.charAt(0)}</b><span><strong>{t.n}</strong><small>Khách hàng thân thiết</small></span></span></div></article>)}</div></section>
  </main>;
};

export default Home;