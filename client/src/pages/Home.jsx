import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import ProductCard from '../components/ProductCard';
import Icon from '../components/Icon';
import { useCart } from '../context/CartContext';
import heroImage from '../assets/inox-editorial-hero.png';
import { categoryImages, categoryImagePositions } from '../data/productImages';
import '../App.css';
import './Home.css';

const categoryTiles = [
  { key: 'noi-chao', title: 'Nồi và chảo', note: 'Đáy từ ba lớp, dùng được trên mọi loại bếp' },
  { key: 'bat-dia', title: 'Bát đĩa', note: 'Nguyên khối, nhẹ tay và không bám dầu mỡ' },
  { key: 'dung-cu', title: 'Dụng cụ bếp', note: 'Dao, thớt, ấm cho nhịp nấu hằng ngày' },
  { key: 'luu-tru', title: 'Lưu trữ', note: 'Hộp, bình, rổ giữ trọn độ tươi' },
];

const quickTerms = ['Nồi inox', 'Bình giữ nhiệt', 'Dao bếp', 'Hộp bảo quản'];

const trustItems = [
  { icon: 'shield', title: 'Inox 304 được kiểm định', desc: 'Chứng nhận an toàn thực phẩm theo từng lô hàng nhập về.' },
  { icon: 'refresh', title: 'Đổi trả trong 30 ngày', desc: 'Nếu sản phẩm chưa qua sử dụng và còn nguyên tem niêm phong.' },
  { icon: 'truck', title: 'Giao nhanh nội thành 2 giờ', desc: 'TP. Hồ Chí Minh trong ngày, toàn quốc từ 2 đến 4 ngày.' },
];

const standards = [
  {
    num: '01', icon: 'shield', title: 'Kiểm định vật liệu',
    desc: 'Mỗi lô hàng được kiểm tra chứng nhận inox 304: độ bền bề mặt, độ dày đáy và khả năng chịu nhiệt trước khi đưa vào danh mục.',
    note: 'An toàn cho tiếp xúc thực phẩm', noteIcon: 'check',
  },
  {
    num: '02', icon: 'refresh', title: 'Chính sách minh bạch',
    desc: 'Giá niêm yết rõ ràng, không phụ phí ẩn. Đổi trả trong 30 ngày và bảo hành lỗi sản xuất đến 24 tháng cho mọi vật dụng.',
    note: 'Điều khoản ghi rõ trước khi mua', noteIcon: 'check',
  },
  {
    num: '03', icon: 'truck', title: 'Giao hàng tận nơi',
    desc: 'Nội thành giao trong vòng 2 giờ kèm kiểm tra hàng tại chỗ. Toàn quốc từ 2 đến 4 ngày, đóng gói chống va đập.',
    note: 'Hẹn giờ giao linh hoạt', noteIcon: 'clock',
  },
];

const testimonials = [
  {
    quote: 'Bộ nồi nhà mình dùng gần hai năm, đáy từ vẫn bắt nhiệt đều và bề mặt vẫn sáng như mới. Đắt hơn hàng ngoài chợ một chút nhưng quá đáng tiền.',
    name: 'Chị Mai Lan',
    city: 'TP. Hồ Chí Minh',
    bought: 'Bộ nồi inox 304, 5 món',
  },
  {
    quote: 'Đặt lúc 9 giờ sáng, đến 11 giờ trưa đã nhận được hàng. Nhân viên gọi xác nhận rất nhẹ nhàng và không ép mua thêm gì cả.',
    name: 'Anh Trung Kiên',
    city: 'Hà Nội',
    bought: 'Bình giữ nhiệt inox 2 lít',
  },
  {
    quote: 'Bát đĩa inox không lo vỡ khi con nhỏ lỡ tay đánh rơi. Nhà mình đã thay dần gần hết đồ bếp bằng inox ở đây.',
    name: 'Chị Thu Hà',
    city: 'Đà Nẵng',
    bought: 'Bộ 3 bát inox nguyên khối',
  },
];

const faqs = [
  { q: 'Nồi, chảo inox 304 có dùng được trên bếp từ không?', a: 'Có. Toàn bộ nồi, chảo trong danh mục có đáy từ ba lớp (inox – nhôm – inox), bắt nhiệt đều và dùng tốt trên mọi loại bếp từ, gas, hồng ngoại.' },
  { q: 'Đơn hàng bao lâu thì nhận được?', a: 'Nội thành TP. Hồ Chí Minh giao trong vòng 2 giờ, kèm kiểm tra hàng tại chỗ. Các tỉnh thành khác từ 2 đến 4 ngày, đóng gói chống va đập.' },
  { q: 'Mua rồi nhưng không vừa ý thì sao?', a: 'Bạn được đổi trả trong 30 ngày nếu sản phẩm chưa qua sử dụng và còn tem niêm phong. Hoàn tiền trong 48 giờ sau khi chúng tôi nhận lại hàng.' },
  { q: 'Sản phẩm có được bảo hành không?', a: 'Mọi vật dụng đều bảo hành lỗi sản xuất đến 24 tháng. Thẻ bảo hành ghi rõ trên hóa đơn, không cần đăng ký thêm bước nào.' },
  { q: 'Làm sao để inox luôn sáng như mới?', a: 'Rửa bằng nước ấm pha baking soda hoặc giấm loãng, lau khô ngay sau khi dùng. Tránh chà bằng bàn chải kim loại — bề mặt sẽ giữ sáng rất lâu.' },
];

const Home = () => {
  const { products, categories, loading, error, reload } = useCatalog();
  const featured = products.filter((p) => p.badge === 'hot');
  const navigate = useNavigate();
  const { showToast } = useCart();
  const [openFaq, setOpenFaq] = useState(-1);
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
      await navigator.clipboard.writeText('INOX10');
      showToast('Đã sao chép mã INOX10');
    } catch {
      showToast('Mã ưu đãi của bạn: INOX10');
    }
  };

  return (
    <main className="container home">
      {/* ===== SECTION 1: HERO + SEARCH CONSOLE ===== */}
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-grid">
          <div className="hero-copy">
            <p className="hero-badge">
              <span className="dot" aria-hidden="true" />
              Danh mục inox được kiểm định · 2026
            </p>
            <h1 id="hero-title">Chọn một lần,<br />dùng thật lâu.</h1>
            <p className="hero-sub">
              Vật dụng inox 304 được tuyển chọn cho căn bếp Việt — bền, an toàn và dễ vệ sinh,
              giảm nhu cầu thay mới mỗi năm.
            </p>

            <form className="search-console" role="search" onSubmit={submitSearch}>
              <label className="sc-field sc-query">
                <Icon name="search" size={18} />
                <span className="sr-only">Tìm sản phẩm</span>
                <input
                  type="search"
                  placeholder="Tìm nồi, chảo, dao, hộp đựng..."
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
              <img src={heroImage} alt="Bộ nồi và dụng cụ bếp inox 304 trên bàn bếp" />
              <figcaption className="hero-seal">
                <span className="seal-icon"><Icon name="shield" size={22} /></span>
                <span>
                  <strong>Inox 304 an toàn thực phẩm</strong>
                  <small>Kiểm tra chứng nhận theo từng lô hàng</small>
                </span>
              </figcaption>
            </figure>
            <div className="hero-widget">
              <span className="hw-label">Vòng đời sử dụng</span>
              <p className="hw-value">10+ năm</p>
              <span className="hw-desc">trung bình cho mỗi vật dụng inox 304</span>
              <p className="hw-note"><Icon name="refresh" size={14} /><span>Thay mới ít hơn, rác thải ít hơn</span></p>
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
        <div className="section-head">
          <p className="eyebrow">Danh mục tuyển chọn</p>
          <h2 id="categories-title">Bắt đầu từ một góc bếp</h2>
          <p>Bốn nhóm vật dụng lấp đầy nhịp nấu nướng và lưu trữ hằng ngày của căn bếp Việt.</p>
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
                  <em>{count} sản phẩm →</em>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ===== SECTION 3: SẢN PHẨM NỔI BẬT — dẫn sang /san-pham ===== */}
      <section className="featured" aria-labelledby="featured-title">
        <div className="featured-head">
          <div className="section-head">
            <p className="eyebrow">Bán chạy nhất</p>
            <h2 id="featured-title">Được gia đình Việt chọn nhiều nhất</h2>
            <p>Bốn món được đặt hàng nhiều nhất tháng này — bộ sưu tập đầy đủ đang chờ ở trang sản phẩm.</p>
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
        <div className="section-head">
          <p className="eyebrow">Tiêu chuẩn tuyển chọn</p>
          <h2 id="standards-title">Mỗi món đồ qua ba vòng kiểm</h2>
          <p>Chúng tôi giữ danh mục nhỏ để kiểm soát chất lượng — mọi vật dụng đều qua cùng một quy trình.</p>
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
        <div className="section-head">
          <p className="eyebrow">Cảm nhận thực tế</p>
          <h2 id="reviews-title">Gia đình Việt nói gì</h2>
          <p>Những phản hồi từ khách hàng đã mua và dùng mỗi ngày.</p>
        </div>
        <div className="t-grid">
          {testimonials.map((t) => (
            <figure className="t-card reveal" key={t.name}>
              <span className="t-stars" aria-label="Đánh giá 5 trên 5">★★★★★</span>
              <blockquote>{t.quote}</blockquote>
              <figcaption>
                <strong>{t.name}</strong>
                <span>{t.city} · đã mua {t.bought}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ===== SECTION 6: CÂU CHUYỆN NHÀ — dẫn sang /about ===== */}
      <section className="story-strip" aria-labelledby="story-title">
        <figure className="story-photo reveal">
          <img src={categoryImages['dung-cu']} alt="Dụng cụ bếp inox 304 sắp gọn gàng trên kệ" />
          <figcaption className="story-sticker">
            <span className="story-dot" aria-hidden="true" />
            Từ 2015 · hơn 50.000 gia đình
          </figcaption>
        </figure>
        <div className="story-copy">
          <p className="eyebrow">Chuyện nhà</p>
          <h2 id="story-title">Chọn kỹ một chút, bếp nhẹ bớt một chút.</h2>
          <p>Chúng tôi tin căn bếp đẹp bắt đầu từ những món đồ đúng — mỗi sản phẩm đều qua tay người thật và được kiểm tra thật trước khi đến với bạn.</p>
          <ul className="story-points">
            <li><Icon name="check" size={15} />Xưởng inox 304 đối tác trực tiếp</li>
            <li><Icon name="check" size={15} />Kiểm định an toàn thực phẩm theo lô</li>
            <li><Icon name="check" size={15} />Đổi trả 30 ngày, bảo hành 24 tháng</li>
          </ul>
          <div className="story-actions">
            <Link to="/about" className="btn btn-olive">Đọc câu chuyện của chúng tôi</Link>
            <Link to="/contact" className="text-link">Gặp đội tư vấn</Link>
          </div>
        </div>
      </section>

      {/* ===== SECTION 7: GIẢI ĐÁP NHANH — FAQ accordion ===== */}
      <section className="faq" aria-labelledby="faq-title">
        <div className="section-head">
          <p className="eyebrow">Giải đáp nhanh</p>
          <h2 id="faq-title">Câu hỏi hay gặp</h2>
          <p>Những điều khách hàng hay hỏi trước khi chọn món đồ inox đầu tiên cho căn bếp.</p>
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
              {openFaq === index && <p className="faq-a">{item.a}</p>}
            </article>
          ))}
        </div>
        <p className="faq-more">
          Vẫn còn thắc mắc?
          <Link to="/contact" className="btn btn-outline">Nhắn cho chúng tôi</Link>
        </p>
      </section>

      {/* ===== SECTION 8: CTA BANNER ===== */}
      <section className="cta-banner">
        <div className="cta-glow" aria-hidden="true" />
        <div className="cta-content">
          <p className="cta-badge"><Icon name="spark" size={13} /><span>Ưu đãi cho đơn đầu tiên</span></p>
          <h3>Giảm 10% với mã INOX10</h3>
          <p>Sao chép mã và nhập lúc thanh toán — áp dụng cho toàn bộ vật dụng trong bộ sưu tập.</p>
        </div>
        <div className="cta-actions">
          <button type="button" className="code-chip" onClick={copyPromo}>
            <span className="code-value">INOX10</span>
            <span className="code-copy"><Icon name="copy" size={13} />Sao chép</span>
          </button>
          <Link to="/contact" className="btn btn-light">Nhận tư vấn</Link>
        </div>
      </section>
    </main>
  );
};

export default Home;
