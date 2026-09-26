import React, { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import ProductCard from '../components/ProductCard';
import Icon from '../components/Icon';
import Breadcrumbs from '../components/Breadcrumbs';
import '../App.css';
import './Products.css';

const sortOptions = [
  { key: 'popular', label: 'Phổ biến nhất' },
  { key: 'price-asc', label: 'Giá thấp đến cao' },
  { key: 'price-desc', label: 'Giá cao đến thấp' },
  { key: 'rating', label: 'Đánh giá cao' },
];

const quickTerms = ['Ghế nhựa', 'Kệ inox', 'Giường tầng', 'Nồi chảo'];

const Products = () => {
  const { products, categories, loading, error, reload } = useCatalog();
  const [searchParams, setSearchParams] = useSearchParams();
  const category = searchParams.get('cat') ?? 'all';
  const query = searchParams.get('q') ?? '';
  const sort = searchParams.get('sort') ?? 'popular';

  const updateParams = (patch) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      const isDefault = value === '' || (key === 'cat' && value === 'all') || (key === 'sort' && value === 'popular');
      if (isDefault) next.delete(key);
      else next.set(key, value);
    });
    setSearchParams(next, { replace: true });
  };

  const filtered = useMemo(() => {
    let list = products.filter((p) =>
      (category === 'all' || p.category === category) &&
      p.name.toLowerCase().includes(query.trim().toLowerCase())
    );
    if (sort === 'price-asc') list = [...list].sort((a, b) => a.price - b.price);
    else if (sort === 'price-desc') list = [...list].sort((a, b) => b.price - a.price);
    else if (sort === 'rating') list = [...list].sort((a, b) => b.rating - a.rating);
    else list = [...list].sort((a, b) => b.sold - a.sold);
    return list;
  }, [products, category, query, sort]);

  if (loading) {
    return (
      <main className="container">
        <Breadcrumbs items={[{ label: 'Sản phẩm' }]} />
        <section className="page-hero">
          <div>
            <p className="eyebrow">Bộ sưu tập inox 304</p>
            <h1>Toàn bộ vật dụng cho căn bếp của bạn.</h1>
          </div>
        </section>
        {/* Skeleton giữ đúng khung lưới sản phẩm để không "giật" layout khi dữ liệu về */}
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
      </main>
    );
  }

  if (error) {
    return (
      <main className="container">
        <Breadcrumbs items={[{ label: 'Sản phẩm' }]} />
        <section className="page-hero">
          <div>
            <p className="eyebrow">Bộ sưu tập inox 304</p>
            <h1>Toàn bộ vật dụng cho căn bếp của bạn.</h1>
          </div>
        </section>
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

  return (
    <main className="container">
      <Breadcrumbs items={[{ label: 'Sản phẩm' }]} />
      <section className="page-hero">
        <div>
          <p className="eyebrow">Bộ sưu tập inox 304</p>
          <h1>Toàn bộ vật dụng cho căn bếp của bạn.</h1>
          <p>Lọc theo danh mục, tìm theo từ khóa và sắp xếp theo giá hoặc đánh giá — mọi lựa chọn đều được ghi vào đường dẫn để bạn lưu lại hoặc chia sẻ.</p>
        </div>
      </section>

      <section className="catalogue" aria-label="Danh mục sản phẩm">
        <div className="catalogue-heading">
          <div className="section-head">
            <p className="eyebrow">Catalogue</p>
            <h2>Tìm theo nhịp bếp của bạn</h2>
          </div>
          <span className="result-count">{filtered.length}/{products.length} SẢN PHẨM</span>
        </div>

        <form className="search-console" role="search" onSubmit={(event) => event.preventDefault()}>
          <label className="sc-field sc-query">
            <Icon name="search" size={18} />
            <span className="sr-only">Tìm sản phẩm</span>
            <input
              type="search"
              placeholder="Tìm nồi, chảo, dao, hộp đựng..."
              value={query}
              onChange={(event) => updateParams({ q: event.target.value })}
            />
          </label>
          <label className="sc-field sc-cat">
            <Icon name="grid" size={17} />
            <span className="sr-only">Chọn danh mục</span>
            <select
              value={category === 'all' ? '' : category}
              onChange={(event) => updateParams({ cat: event.target.value })}
            >
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
            {quickTerms.map((term) => {
              const isActive = query.trim().toLowerCase() === term.toLowerCase();
              return (
                <button
                  type="button"
                  key={term}
                  className={`quick-chip${isActive ? ' active' : ''}`}
                  aria-pressed={isActive}
                  onClick={() => updateParams({ q: isActive ? '' : term })}
                >
                  {term}
                </button>
              );
            })}
          </div>
        </div>

        <div className="toolbar">
          <div className="chips" role="group" aria-label="Lọc theo danh mục">
            {categories.map((c) => (
              <button
                type="button"
                key={c.key}
                className={`chip${category === c.key ? ' active' : ''}`}
                aria-pressed={category === c.key}
                onClick={() => updateParams({ cat: c.key })}
              >
                {c.label}
              </button>
            ))}
          </div>
          <label className="sort-box">
            <span className="sr-only">Sắp xếp sản phẩm</span>
            <select value={sort} onChange={(event) => updateParams({ sort: event.target.value })}>
              {sortOptions.map((option) => (
                <option key={option.key} value={option.key}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>

        <p className="result-hint">
          <span>
            {filtered.length
              ? `Hiển thị ${filtered.length} trên ${products.length} sản phẩm${query.trim() ? ` cho “${query.trim()}”` : ''}.`
              : 'Không có sản phẩm nào khớp bộ lọc hiện tại.'}
          </span>
          {(query.trim() || category !== 'all' || sort !== 'popular') && (
            <button type="button" onClick={() => updateParams({ q: '', cat: 'all', sort: 'popular' })}>
              <Icon name="close" size={12} strokeWidth={2} />
              Xóa lọc
            </button>
          )}
        </p>

        {filtered.length ? (
          <div className="product-grid">
            {filtered.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        ) : (
          <div className="empty-state">
            <h3>Chưa có sản phẩm nào khớp</h3>
            <p>Thử từ khóa ngắn hơn hoặc bỏ lọc danh mục để xem toàn bộ bộ sưu tập inox 304.</p>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => updateParams({ q: '', cat: 'all', sort: 'popular' })}
            >
              <Icon name="refresh" size={16} />
              Xem tất cả sản phẩm
            </button>
            <Link to="/contact" className="text-link">Cần tư vấn thêm? Nhắn cho chúng tôi</Link>
          </div>
        )}
      </section>
    </main>
  );
};

export default Products;