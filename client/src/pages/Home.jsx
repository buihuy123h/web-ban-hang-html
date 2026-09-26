import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import ProductCard from '../components/ProductCard';
import Icon from '../components/Icon';
import { useCart } from '../context/CartContext';
import { categoryImages, categoryImagePositions, HERO_IMAGE } from '../data/productImages';
import '../App.css';
import './Home.css';

const categoryTiles = [
  { key: 'ban-ghe', title: 'Bàn ghế & ghế nhựa', note: 'Ghế bành, ghế cao Duy Tân cho quán nhậu, tiệc ngoài trời' },
  { key: 'noi-that', title: 'Nội thất phòng trọ', note: 'Giường tầng, tủ nhựa, bàn học — giá tốt cho người thuê trọ' },
  { key: 'noi-chao', title: 'Nồi, chảo quán ăn', note: 'Nồi soup, chảo sâu lòng cho quán nấu nền mỗi ngày' },
  { key: 'bat-dia', title: 'Bát đĩa & khay', note: 'Bát đĩa inox, khay phục vụ lớn cho quán và gia đình' },
  { key: 'dung-cu', title: 'Dụng cụ bếp', note: 'Dao, thớt, muỗng nĩa — đủ việc sơ chế và phục vụ' },
  { key: 'luu-tru', title: 'Kệ inox & lưu trữ', note: 'Kệ 4 tầng, hộp, rổ — sắp gọn kho và bếp quán' },
];

const quickTerms = ['Ghế nhựa', 'Kệ inox', 'Giường tầng', 'Nồi chảo'];

const trustItems = [
  { icon: 'shield', title: 'Kiểm tra kỹ trước khi bán', desc: 'Mỗi món được thử hoạt động, vệ sinh và chụp ảnh thật trước khi lên web.' },
  { icon: 'refresh', title: 'Xem hàng trước khi chốt', desc: 'Ghé kho trực tiếp hoặc nhận video thử hàng qua Zalo khi ở xa.' },
  { icon: 'truck', title: 'Gửi qua nhà xe toàn quốc', desc: 'Nội thành TP.HCM giao trong ngày, tỉnh khác gửi qua nhà xe giá rẻ.' },
];

/* Dải USP chạy ngang (marquee) — items được nhân đôi trong JSX để cuộn liền mạch */
const uspItems = [
  { icon: 'shield', text: 'Kiểm tra kỹ từng món trước khi bán' },
  { icon: 'refresh', text: 'Xem hàng tại kho hoặc qua video' },
  { icon: 'truck', text: 'Gửi nhà xe 63 tỉnh' },
  { icon: 'clock', text: 'Nội thành TP.HCM giao trong ngày' },
  { icon: 'spark', text: 'Giá thanh lý thật — không thổi giá' },
  { icon: 'check', text: 'Ảnh thật, món nào vậy nấy' },
];

const standards = [
  {
    num: '01', icon: 'refresh', title: 'Thu mua chắt lọc',
    desc: 'Nguồn hàng từ quán xá, nhà trọ thanh lý. Chỉ giữ lại món còn dùng tốt, bỏ ngay món hư nặng không sửa được.',
    note: 'Không bán hàng "trôi nổi" không rõ nguồn', noteIcon: 'check',
  },
  {
    num: '02', icon: 'shield', title: 'Kiểm tra & vệ sinh',
    desc: 'Mỗi món được thử tại chỗ: ghế chịu tải, quạt chạy êm, nồi dùng được trên bếp. Sau đó vệ sinh sạch sẽ trước khi nhập kho.',
    note: 'Ảnh thật — món nào vậy nấy', noteIcon: 'check',
  },
  {
    num: '03', icon: 'truck', title: 'Giá thanh lý, giao nhanh',
    desc: 'Giá niêm yết rẻ nhất có thể, mua nhiều ib báo giá sỉ. Nội thành giao trong ngày, tỉnh khác gửi qua nhà xe.',
    note: 'Hỗ trợ gửi hàng toàn quốc', noteIcon: 'clock',
  },
];

const testimonials = [
  {
    quote: 'Mở quán nhậu cần ba chục ghế bành, nhắn ib một buổi là có hàng giao tận nơi. Ghế còn như mới, giá rẻ hơn mua mới gần nửa.',
    name: 'Anh Tuấn',
    city: 'TP. Hồ Chí Minh',
    bought: 'Ghế nhựa bành lớn',
  },
  {
    quote: 'Cho con thuê trọ, lấy giường tầng ngang 1m ở đây. Khung sắt chắc, thợ giao lắp nhiệt tình, chốt nhanh gọn lẹ.',
    name: 'Chị Hồng',
    city: 'Gò Vấp',
    bought: 'Giường tầng ngang 1 m',
  },
  {
    quote: 'Kệ inox 4 tầng gửi ra Vũng Tàu qua nhà xe, thùng đóng kỹ. Đồ đúng như hình, dùng cho quán phở rất ổn.',
    name: 'Anh Huy',
    city: 'Vũng Tàu',
    bought: 'Kệ inox 4 tầng',
  },
];

const faqs = [
  { q: 'Đồ cũ ở đây có còn dùng tốt không?', a: 'Có. Mỗi món được kiểm tra hoạt động và vệ sinh trước khi bán. Món nào có lỗi gì chúng tôi ghi rõ trong mô tả — hình cũng là hình thật của món đó.' },
  { q: 'Bạn có giao hàng đi tỉnh không?', a: 'Có. Hàng được gửi qua nhà xe — rẻ và nhanh, phí theo bến xe. Đóng gói kỹ, gửi kèm mã bến để bạn nhận hàng thuận tiện.' },
  { q: 'Mua nhiều cho quán mới mở có được giá tốt hơn?', a: 'Có. Nhắn danh sách món cần qua Zalo hoặc Facebook, bên mình báo giá sỉ rẻ nhất. Đơn lớn có thể hỗ trợ giao tận quán trong nội thành.' },
  { q: 'Có thể xem hàng trực tiếp không?', a: 'Được. Ghé kho tại 707 Tân Sơn, P. An Hội Tây, Gò Vấp từ 08:00 đến 21:00 mỗi ngày. Xem thoải mái, không mua cũng không sao.' },
  { q: 'Nhận hàng rồi không ưng thì sao?', a: 'Bạn kiểm tra hàng trước khi nhận hoặc qua video. Nếu hàng không đúng mô tả, hỗ trợ đổi trong ngày hoặc hoàn tiền.' },
];

const Home = () => {
  const { products, categories, loading, error, reload } = useCatalog();
  const featured = products.filter((p) => p.badge === 'hot');
  const navigate = useNavigate();
  const { showToast } = useCart();
  const [openFaq, setOpenFaq] = useState(-1);
  const [copied, setCopied] = useState(false);
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('');

  const goProducts = ({ q = '', cat: nextCat = '' } = {}) => {
    const search = new URLSearchParams();
    if (q) search.set('q', q);
    if (nextCat) search.set('cat', nextCat);
    const qs = search.toString();
    navigate(qs ? `/san-pham?${qs}` : '/san-pham');
  };

  const submitSearch = (event) => {
    event.preventDefault();
    goProducts({ q: query.trim(), cat });
  };

  const copyPromo = async () => {
    try {
      await navigator.clipboard.writeText('QUANGHUY10');
      showToast('Đã sao chép mã QUANGHUY10');
    } catch {
      showToast('Mã ưu đãi của bạn: QUANGHUY10');
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <main className="container home">
      {/* ===== SECTION 1: HERO + SEARCH CONSOLE ===== */}
      <section className="hero" aria-labelledby="hero-title">
        <span className="hero-blob" aria-hidden="true" />
        <div className="hero-grid">
          <div className="hero-copy">
            <p className="hero-badge">
              <span className="dot" aria-hidden="true" />
              Đồ cũ thanh lý · Gò Vấp, TP.HCM
            </p>
            <h1 id="hero-title">Đồ cũ còn tốt,<br />giá thì như mới.</h1>
            <p className="hero-sub">
              Chuyên mua và bán đồ cũ thanh lý: ghế nhựa, kệ inox, giường tầng, nồi chảo...
              thu từ quán xá, nhà trọ — kiểm tra kỹ từng món, giá rẻ nhất, gửi qua nhà xe toàn quốc.
            </p>

            <form className="search-console" role="search" onSubmit={submitSearch}>
              <label className="sc-field sc-query">
                <Icon name="search" size={18} />
                <span className="sr-only">Tìm sản phẩm</span>
                <input
                  type="search"
                  placeholder="Tìm ghế nhựa, kệ inox, giường tầng..."
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <label className="sc-field sc-cat">
                <Icon name="grid" size={17} />
                <span className="sr-only">Chọn danh mục</span>
                <select value={cat} onChange={(event) => setCat(event.target.value)}>
                  <option value="">Tất cả danh mục</option>
                  {categories.filter((c) => c.key !== 'all').map((c) => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
              </label>
              <button type="submit" className="sc-submit">
                <Icon name="search" size={16} strokeWidth={2} />
                <span>Tìm kiếm</span>
              </button>
            </form>

            <div className="quick-row">
              <span className="quick-label">Tìm nhanh:</span>
              <div className="quick-chips">
                {quickTerms.map((term) => (
                  <button
                    type="button"
                    key={term}
                    className="quick-chip"
                    onClick={() => goProducts({ q: term })}
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="hero-visual">
            <figure className="hero-photo">
              <img src={HERO_IMAGE} alt="Kệ inox và đồ dùng nhà bếp tại kho Đồ Cũ Quang Huy" width={1774} height={887} fetchpriority="high" decoding="async" />
              <figcaption className="hero-seal">
                <span className="seal-icon"><Icon name="shield" size={22} /></span>
                <span>
                  <strong>Hàng thật — hình thật</strong>
                  <small>Đã kiểm tra &amp; vệ sinh trước khi bán</small>
                </span>
              </figcaption>
            </figure>
            <div className="hero-widget">
              <span className="hw-label">Hàng mới về</span>
              <p className="hw-value">Mỗi tuần</p>
              <span className="hw-desc">hàng thanh lý quán xá, nhà trọ về liên tục</span>
              <p className="hw-note"><Icon name="refresh" size={14} /><span>Số lượng có hạn — nhanh tay kẻo lỡ</span></p>
            </div>
          </div>
        </div>

        <div className="trust-strip">
          {trustItems.map((item) => (
            <div className="trust-item" key={item.title}>
              <span className="ts-icon"><Icon name={item.icon} size={20} /></span>
              <div>
                <strong>{item.title}</strong>
                <span>{item.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== SECTION 2: DANH MỤC TUYỂN CHỌN ===== */}
      <section className="category-band" aria-labelledby="categories-title">
        <div className="section-head reveal">
          <p className="eyebrow">Danh mục tuyển chọn</p>
          <h2 id="categories-title">Sáu nhóm đồ luôn sẵn có</h2>
          <p>Từ ghế nhựa quán nhậu đến kệ inox nhà bếp — hàng thanh lý về liên tục mỗi tuần.</p>
        </div>
        <div className="category-tiles">
          {categoryTiles.map((tile) => {
            const count = products.filter((p) => p.category === tile.key).length;
            return (
              <Link
                to={`/san-pham?cat=${tile.key}`}
                key={tile.key}
                className="cat-tile reveal"
              >
                <img
                  src={categoryImages[tile.key]}
                  alt=""
                  loading="lazy"
                  style={{ objectPosition: categoryImagePositions[tile.key][0] }}
                />
                <span className="cat-tile-copy">
                  <strong>{tile.title}</strong>
                  <small>{tile.note}</small>
                  <em>{count} sản phẩm <span className="cat-arrow" aria-hidden="true">→</span></em>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ===== SECTION 3: SẢN PHẨM NỔI BẬT — dẫn sang /san-pham ===== */}
      <section className="featured" aria-labelledby="featured-title">
        <div className="featured-head">
          <div className="section-head reveal">
            <p className="eyebrow">Bán chạy nhất</p>
            <h2 id="featured-title">Được khách chốt nhiều nhất</h2>
            <p>Bốn món đang được chốt nhiều nhất — hàng thanh lý số lượng có hạn, ai nhanh tay người đó có.</p>
          </div>
          <Link to="/san-pham" className="btn btn-outline">Xem tất cả sản phẩm</Link>
        </div>
        {error ? (
          <div className="empty-state">
            <h3>Không tải được sản phẩm</h3>
            <p>{error}</p>
            <button type="button" className="btn btn-outline" onClick={reload}>
              <Icon name="refresh" size={16} />
              Thử lại
            </button>
          </div>
        ) : loading ? (
          <div className="product-grid" aria-hidden="true">
            {Array.from({ length: 4 }, (_, index) => (
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
        ) : (
          <div className="product-grid">
            {featured.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </section>

      {/* ===== SECTION 4: TIÊU CHUẨN TUYỂN CHỌN ===== */}
      <section className="standards" aria-labelledby="standards-title">
        <div className="section-head reveal">
          <p className="eyebrow">Tiêu chuẩn tuyển chọn</p>
          <h2 id="standards-title">Mỗi món đồ qua ba vòng kiểm</h2>
          <p>Mỗi món đều qua tay người thật: kiểm tra, vệ sinh, chụp ảnh thật trước khi lên web.</p>
        </div>
        <div className="standards-grid">
          {standards.map((item) => (
            <article className="std-card reveal" key={item.num}>
              <header>
                <span className="std-num">{item.num}</span>
                <span className="std-icon"><Icon name={item.icon} size={20} /></span>
              </header>
              <h3>{item.title}</h3>
              <p>{item.desc}</p>
              <footer>
                <Icon name={item.noteIcon} size={15} />
                <span>{item.note}</span>
              </footer>
            </article>
          ))}
        </div>
      </section>

      {/* ===== SECTION 5: CẢM NHẬN KHÁCH HÀNG ===== */}
      <section className="testimonials" aria-labelledby="reviews-title">
        <div className="section-head reveal">
          <p className="eyebrow">Cảm nhận thực tế</p>
          <h2 id="reviews-title">Khách quen nói gì</h2>
          <p>Những phản hồi thật từ người đã mua và dùng đồ ở kho.</p>
        </div>
        <div className="t-grid">
          {testimonials.map((t) => (
            <figure className="t-card reveal" key={t.name}>
              <span className="t-quote" aria-hidden="true">“</span>
              <span className="t-stars" aria-label="Đánh giá 5 trên 5">★★★★★</span>
              <blockquote>{t.quote}</blockquote>
              <figcaption>
                <span className="t-avatar" aria-hidden="true">{t.name.split(' ').pop().charAt(0)}</span>
                <span className="t-who">
                  <strong>{t.name}</strong>
                  <span>{t.city} · đã mua {t.bought}</span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ===== Dải USP chạy ngang — divider giữa trang ===== */}
      <section className="usp-marquee" aria-label="Cam kết của chúng tôi">
        <div className="usp-track">
          {[...uspItems, ...uspItems].map((item, index) => (
            <span className="usp-item" key={index}>
              <Icon name={item.icon} size={15} />
              {item.text}
            </span>
          ))}
        </div>
      </section>

      {/* ===== SECTION 6: CÂU CHUYỆN NHÀ — dẫn sang /about ===== */}
      <section className="story-strip" aria-labelledby="story-title">
        <figure className="story-photo reveal">
          <img src={categoryImages['luu-tru']} alt="Kệ inox và đồ dùng nhà bếp tại kho Đồ Cũ Quang Huy" />
          <figcaption className="story-sticker">
            <span className="story-dot" aria-hidden="true" />
            Hàng về mỗi tuần · số lượng có hạn
          </figcaption>
        </figure>
        <div className="story-copy reveal">
          <p className="eyebrow">Chuyện nhà</p>
          <h2 id="story-title">Đồ cũ còn dùng tốt, bỏ đi thì tiếc.</h2>
          <p>Quán xá thanh lý, nhà trọ trả phòng — bên mình đi thu mua từng đợt, chọn lại món còn dùng ổn, bán bằng giá thật cho người đang cần mở quán, thuê trọ.</p>
          <ul className="story-points">
            <li><Icon name="check" size={15} />Chuyên mua &amp; bán — nguồn hàng thanh lý quán xá, nhà trọ</li>
            <li><Icon name="check" size={15} />Kiểm tra &amp; vệ sinh từng món trước khi bán</li>
            <li><Icon name="check" size={15} />Xem hàng tại chỗ hoặc qua video trước khi chốt</li>
            <li><Icon name="check" size={15} />Gửi hàng qua nhà xe khắp 63 tỉnh</li>
          </ul>
          <div className="story-actions">
            <Link to="/about" className="btn btn-olive">Đọc câu chuyện của chúng tôi</Link>
            <Link to="/contact" className="text-link">Gặp đội tư vấn</Link>
          </div>
        </div>
      </section>

      {/* ===== SECTION 7: GIẢI ĐÁP NHANH — FAQ accordion ===== */}
      <section className="faq" aria-labelledby="faq-title">
        <div className="section-head reveal">
          <p className="eyebrow">Giải đáp nhanh</p>
          <h2 id="faq-title">Câu hỏi hay gặp</h2>
          <p>Những điều khách hay hỏi trước khi chốt món đồ cũ đầu tiên.</p>
        </div>
        <div className="faq-list">
          {faqs.map((item, index) => (
            <article className={`faq-item${openFaq === index ? ' open' : ''}`} key={item.q}>
              <button
                type="button"
                className="faq-q"
                aria-expanded={openFaq === index}
                onClick={() => setOpenFaq(openFaq === index ? -1 : index)}
              >
                <strong>{item.q}</strong>
                <span className="faq-icon"><Icon name={openFaq === index ? 'minus' : 'plus'} size={16} strokeWidth={2.2} /></span>
              </button>
              <div className={`faq-a-wrap${openFaq === index ? ' open' : ''}`}>
                <div className="faq-a-inner">
                  <p className="faq-a">{item.a}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
        <p className="faq-more">
          Vẫn còn thắc mắc?
          <Link to="/contact" className="btn btn-outline">Nhắn cho chúng tôi</Link>
        </p>
      </section>

      {/* ===== SECTION 8: CTA BANNER ===== */}
      <section className="cta-banner reveal">
        <div className="cta-glow" aria-hidden="true" />
        <div className="cta-content">
          <p className="cta-badge"><Icon name="spark" size={13} /><span>Ưu đãi cho đơn đầu tiên</span></p>
          <h3>Giảm 10% với mã QUANGHUY10</h3>
          <p>Sao chép mã và nhập lúc thanh toán — áp dụng cho mọi món trong đơn.</p>
        </div>
        <div className="cta-actions">
          <button type="button" className={`code-chip${copied ? ' copied' : ''}`} onClick={copyPromo}>
            <span className="code-value">QUANGHUY10</span>
            <span className="code-copy"><Icon name={copied ? 'check' : 'copy'} size={13} />{copied ? 'Đã sao chép' : 'Sao chép'}</span>
          </button>
          <Link to="/contact" className="btn btn-light">Nhận tư vấn</Link>
        </div>
      </section>
    </main>
  );
};

export default Home;
