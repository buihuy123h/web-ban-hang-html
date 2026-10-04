import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import ProductCard from '../components/ProductCard';
import Icon from '../components/Icon';
import './Products.css';

const sortOptions = [
  { key: 'newest', label: 'Hàng mới về hôm nay' },
  { key: 'discount-high', label: 'Giảm giá sâu nhất (đến 70%)' },
  { key: 'condition-high', label: 'Độ mới cao nhất (98-99%)' },
  { key: 'price-asc', label: 'Giá từ thấp đến cao' },
  { key: 'price-desc', label: 'Giá từ cao xuống thấp' },
];

const gradeOptions = [
  { key: '99', title: 'Mới 99% (Trưng bày/Chưa dùng)', note: 'Hàng tồn kho nguyên hộp hoặc hàng mẫu', count: '18 món' },
  { key: '95-98', title: 'Mới 95 - 98% (Lướt đẹp)', note: 'Rất ít sử dụng, không móp méo, bóng đẹp', count: '64 món' },
  { key: '90-95', title: 'Mới 90 - 95% (Máy tốt, xước dăm)', note: 'Ngoại hình có vết xước dăm nhẹ tự nhiên', count: '47 món' },
  { key: '85-90', title: 'Mới 85 - 90% (Xả cực rẻ)', note: 'Xả thu hồi vốn cho thợ và quán ăn', count: '19 món' },
];

const materialChips = ['Inox SUS 304', 'Gỗ Sồi Tự Nhiên', 'Gỗ Xoan Đào', 'Thép Sơn Tĩnh Điện', 'Nhựa ABS Bền'];
const priceRanges = [
  { key: 'u500', label: 'Dưới 500.000đ', test: (price) => price < 500000 },
  { key: '500-1500', label: '500.000đ - 1.500.000đ', test: (price) => price >= 500000 && price <= 1500000 },
  { key: '1500-3000', label: '1.500.000đ - 3.000.000đ', test: (price) => price > 1500000 && price <= 3000000 },
  { key: 't3000', label: 'Trên 3.000.000đ', test: (price) => price > 3000000 },
];

/* Độ mới mô phỏng ổn định theo id — dùng cho lọc "Độ mới / Tình trạng". */
const gradeOf = (product) => 88 + ((product.id * 7) % 12);

const COUNTDOWN_WINDOW = 12 * 60 * 60;
const useCountdown = () => {
  const [left, setLeft] = useState(() => 9 * 3600 + 42 * 60 + 18);
  useEffect(() => {
    const timer = window.setInterval(() => {
      setLeft((value) => (value <= 1 ? COUNTDOWN_WINDOW : value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);
  const pad = (n) => String(n).padStart(2, '0');
  return [
    { label: 'Giờ', value: pad(Math.floor(left / 3600)) },
    { label: 'Phút', value: pad(Math.floor((left % 3600) / 60)) },
    { label: 'Giây', value: pad(left % 60) },
  ];
};

const Products = () => {
  const { products, categories, loading, error, reload } = useCatalog();
  const [searchParams, setSearchParams] = useSearchParams();
  const category = searchParams.get('cat') ?? 'all';
  const sort = searchParams.get('sort') ?? 'newest';
  const price = searchParams.get('price') ?? '';
  const grades = (searchParams.get('grade') ?? '').split(',').filter(Boolean);

  const updateParams = (patch) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      const isDefault = value === '' || value === null || (key === 'cat' && value === 'all') || (key === 'sort' && value === 'newest');
      if (isDefault) next.delete(key);
      else next.set(key, value);
    });
    setSearchParams(next, { replace: true });
  };
  const clearFilters = () => setSearchParams(new URLSearchParams(), { replace: true });
  const hasFilters = category !== 'all' || sort !== 'newest' || price !== '' || grades.length > 0;
  const countdown = useCountdown();
  const [material, setMaterial] = useState('Inox SUS 304');

  const categoryCounts = useMemo(() => {
    const counts = { all: products.length };
    products.forEach((product) => {
      counts[product.category] = (counts[product.category] ?? 0) + 1;
    });
    return counts;
  }, [products]);

  const gradeKey = grades.join(',');
  const filtered = useMemo(() => {
    let list = products.filter((p) => category === 'all' || p.category === category);
    const range = priceRanges.find((item) => item.key === price);
    if (range) list = list.filter((p) => range.test(p.price));
    if (grades.length > 0) {
      list = list.filter((p) => grades.some((key) => {
        const value = gradeOf(p);
        if (key === '99') return value >= 99;
        if (key === '95-98') return value >= 95 && value <= 98;
        if (key === '90-95') return value >= 90 && value <= 95;
        return value < 90;
      }));
    }
    const discountOf = (p) => (p.oldPrice ? 1 - p.price / p.oldPrice : 0);
    if (sort === 'price-asc') list = [...list].sort((a, b) => a.price - b.price);
    else if (sort === 'price-desc') list = [...list].sort((a, b) => b.price - a.price);
    else if (sort === 'condition-high') list = [...list].sort((a, b) => gradeOf(b) - gradeOf(a));
    else if (sort === 'discount-high') list = [...list].sort((a, b) => discountOf(b) - discountOf(a));
    else list = [...list].sort((a, b) => b.id - a.id);
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, category, price, gradeKey, sort]);

  const warehouseCounts = useMemo(() => {
    const hcm = Math.round(products.length * 0.42);
    return { hn: products.length - hcm, hcm };
  }, [products.length]);

  return (
    <main className="container products-page">
      <nav className="xq-crumbs" aria-label="Breadcrumb">
        <Link to="/" className="xq-crumbs-link"><Icon name="home" size={13} />Trang chủ</Link>
        <Icon name="chevronRight" size={12} />
        <span className="xq-crumbs-mid">Danh mục xả kho</span>
        <Icon name="chevronRight" size={12} />
        <strong>Đồ Inox, Nội thất &amp; Gia dụng tuyển chọn</strong>
      </nav>

      <section className="xq-hero" aria-labelledby="products-title">
        <div className="xq-hero-glow xq-hero-glow-a" aria-hidden="true" />
        <div className="xq-hero-glow xq-hero-glow-b" aria-hidden="true" />
        <div className="xq-hero-row">
          <div className="xq-hero-copy">
            <p className="xq-hero-pill"><span className="xq-hero-pill-dot" aria-hidden="true" />Cập nhật kho 8:00 sáng hàng ngày • Số lượng có hạn</p>
            <h1 id="products-title">Đại Tiệc Xả Kho Thanh Lý - Giảm 50% Đến 75%</h1>
            <p className="xq-hero-sub">
              Mỗi món chỉ có 1 đến vài chiếc độc bản. Toàn bộ thiết bị inox, nội thất mộc và điện gia dụng đã qua 12 bước thẩm định công năng và khử trùng tia cực tím.
            </p>
          </div>
          <div className="xq-hero-box">
            <div className="xq-countdown">
              <span className="xq-countdown-label">Thời hạn giữ giá xả kho</span>
              <div className="xq-countdown-timer" role="timer" aria-label="Đếm ngược giữ giá">
                {countdown.map((unit, index) => (
                  <React.Fragment key={unit.label}>
                    {index > 0 && <span className="xq-countdown-sep" aria-hidden="true">:</span>}
                    <span className="xq-countdown-unit">
                      <strong>{unit.value}</strong>
                      <small>{unit.label}</small>
                    </span>
                  </React.Fragment>
                ))}
              </div>
            </div>
            <div className="xq-hero-sep" aria-hidden="true" />
            <div className="xq-hero-stats">
              <span><Icon name="truck" size={14} />Giao lắp đặt tận nơi</span>
              <span><Icon name="shield" size={14} />Bao test 7 ngày 1 đổi 1</span>
            </div>
          </div>
        </div>
      </section>

      {loading ? (
        <section className="xq-loading" aria-busy="true" aria-label="Đang tải sản phẩm">
          <div className="xq-filters xq-filters-skel" aria-hidden="true">
            {Array.from({ length: 6 }, (_, index) => <div className="skel" key={index} />)}
          </div>
          <div className="xq-grid" aria-hidden="true">
            {Array.from({ length: 6 }, (_, index) => (
              <div className="skel-card" key={index}>
                <div className="skel skel-media" />
                <div className="skel skel-line w40" />
                <div className="skel skel-line w70" />
              </div>
            ))}
          </div>
        </section>
      ) : error ? (
        <div className="empty-state xq-error" role="alert">
          <h2>Không tải được danh sách sản phẩm</h2>
          <p>{error}</p>
          <button type="button" className="xq-btn xq-btn-primary" onClick={reload}><Icon name="refresh" size={16} />Thử lại</button>
        </div>
      ) : (
        <section className="xq-layout" aria-label="Danh mục sản phẩm xả kho">
          <aside className="xq-filters" aria-label="Bộ lọc sản phẩm">
            <div className="xq-filter-head">
              <h2><Icon name="tune" size={16} />Bộ lọc tuyển chọn</h2>
              <button type="button" onClick={clearFilters}>Xóa tất cả</button>
            </div>

            <div className="xq-filter-group">
              <h3><Icon name="warehouse" size={14} />Kho hàng có sẵn</h3>
              <label className="xq-check-row">
                <span className="xq-check-label"><input type="checkbox" defaultChecked /><span>Kho Hà Nội (Tây Hồ)</span></span>
                <span className="xq-check-count">{warehouseCounts.hn}</span>
              </label>
              <label className="xq-check-row">
                <span className="xq-check-label"><input type="checkbox" defaultChecked /><span>Kho TP.HCM (Quận 1)</span></span>
                <span className="xq-check-count">{warehouseCounts.hcm}</span>
              </label>
            </div>

            <div className="xq-filter-group">
              <h3><Icon name="layers" size={14} />Danh mục xả kho</h3>
              <div className="xq-cat-list">
                <button type="button" className={category === 'all' ? 'active' : ''} onClick={() => updateParams({ cat: 'all' })}>
                  <span>Tất cả sản phẩm</span><span className="xq-cat-count">{categoryCounts.all ?? 0}</span>
                </button>
                {categories.filter((item) => item.key !== 'all').map((item) => (
                  <button type="button" key={item.key} className={category === item.key ? 'active' : ''} onClick={() => updateParams({ cat: item.key })}>
                    <span>{item.label}</span><span className="xq-cat-count">{categoryCounts[item.key] ?? 0}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="xq-filter-group">
              <h3 className="xq-has-info"><Icon name="verified" size={14} />Độ mới / Tình trạng<Icon name="info" size={13} title="Quy chuẩn chấm điểm ngoại quan và độ hao mòn thực tế" /></h3>
              <div className="xq-grade-list">
                {gradeOptions.map((option) => {
                  const checked = grades.includes(option.key);
                  return (
                    <label key={option.key} className="xq-grade-row">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          const next = checked ? grades.filter((item) => item !== option.key) : [...grades, option.key];
                          updateParams({ grade: next.join(',') });
                        }}
                      />
                      <span className="xq-grade-text">
                        <span className="xq-grade-title"><strong>{option.title}</strong><em>{option.count}</em></span>
                        <small>{option.note}</small>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="xq-filter-group">
              <h3><Icon name="layers" size={14} />Chất liệu cốt lõi</h3>
              <div className="xq-chip-list">
                {materialChips.map((chip) => (
                  <button type="button" key={chip} className={material === chip ? 'active' : ''} onClick={() => setMaterial(chip)}>{chip}</button>
                ))}
              </div>
            </div>

            <div className="xq-filter-group">
              <h3><Icon name="payments" size={14} />Khoảng giá thanh lý</h3>
              <div className="xq-radio-list">
                {priceRanges.map((range) => (
                  <label key={range.key} className="xq-radio-row">
                    <input type="radio" name="price-range" checked={price === range.key} onChange={() => updateParams({ price: price === range.key ? '' : range.key })} />
                    <span className={price === range.key ? 'active' : ''}>{range.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="xq-filter-group">
              <h3><Icon name="security" size={14} />Chính sách bảo hành</h3>
              <label className="xq-check-row xq-check-plain"><span className="xq-check-label"><input type="checkbox" defaultChecked /><span>Bảo hành 3 - 6 tháng kỹ thuật</span></span></label>
              <label className="xq-check-row xq-check-plain"><span className="xq-check-label"><input type="checkbox" defaultChecked /><span>Bao test 7 ngày 1 đổi 1 tận nhà</span></span></label>
            </div>

            <div className="xq-zalo-widget">
              <div className="xq-zalo-head"><Icon name="headset" size={17} /><strong>Cần video quay thực tế?</strong></div>
              <p>Nhắn tin nhân viên kho gửi video 360 độ góc cạnh món bạn ưng ý qua Zalo trước khi chốt đơn.</p>
              <a className="xq-btn xq-btn-accent" href="https://zalo.me" target="_blank" rel="noopener noreferrer">
                <Icon name="chat" size={15} />Zalo Kho: 0988.123.456
              </a>
            </div>
          </aside>

          <div className="xq-main">
            <div className="xq-toolbar">
              <p className="xq-toolbar-status"><span className="xq-status-dot" aria-hidden="true" />Đang hiển thị <strong>{filtered.length} sản phẩm</strong> có sẵn hàng tại 2 kho</p>
              <div className="xq-toolbar-tools">
                <label className="xq-sort">
                  <span>Sắp xếp theo:</span>
                  <select value={sort} onChange={(event) => updateParams({ sort: event.target.value })}>
                    {sortOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
                  </select>
                </label>
                <div className="xq-view-toggle" aria-hidden="true">
                  <button type="button" className="active" aria-label="Lưới 3 cột"><Icon name="grid" size={17} /></button>
                  <button type="button" aria-label="Xem danh sách"><Icon name="list" size={17} /></button>
                </div>
              </div>
            </div>

            {hasFilters && (
              <div className="xq-filter-summary">
                <span>Đang áp dụng bộ lọc tuyển chọn — {filtered.length} kết quả.</span>
                <button type="button" onClick={clearFilters}><Icon name="close" size={13} />Xóa tất cả</button>
              </div>
            )}

            {filtered.length ? (
              <div className="xq-grid">
                {filtered.map((product) => <ProductCard key={product.id} product={product} />)}
              </div>
            ) : (
              <div className="empty-state">
                <h2>Chưa có sản phẩm nào khớp bộ lọc</h2>
                <p>Thử bỏ một vài điều kiện lọc hoặc chọn "Tất cả sản phẩm" để xem toàn bộ kho.</p>
                <button type="button" className="xq-btn xq-btn-primary" onClick={clearFilters}><Icon name="refresh" size={16} />Xóa tất cả bộ lọc</button>
              </div>
            )}

            <div className="xq-pagination">
              <p>Hiển thị <strong>1 - {filtered.length}</strong> trong tổng số <strong>{products.length}</strong> sản phẩm tuyển chọn</p>
              <div className="xq-pagination-pages" aria-label="Phân trang">
                <button type="button" disabled aria-label="Trang trước"><Icon name="chevronLeft" size={15} /></button>
                <button type="button" className="active">1</button>
                <button type="button">2</button>
                <button type="button">3</button>
                <span>...</span>
                <button type="button">{Math.max(4, Math.ceil(products.length / 9))}</button>
                <button type="button" className="xq-page-next"><span>Tiếp</span><Icon name="chevronRight" size={15} /></button>
              </div>
            </div>
          </div>
        </section>
      )}
    </main>
  );
};

export default Products;