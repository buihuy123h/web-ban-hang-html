import React from 'react';
import '../pages/Products.css';

const HERO_IMAGE = '/images/catalog/noi-chao.jpg';

const CatalogueBanner = ({ id, title, description, eyebrow = 'Đồ cũ Quang Huy' }) => (
  <section className="catalogue-banner" aria-labelledby={id}>
    <img src={HERO_IMAGE} alt="" decoding="async" />
    <div className="catalogue-banner-overlay">
      <div className="catalogue-banner-copy">
        <p className="eyebrow">{eyebrow}</p>
        <h1 id={id}>{title}</h1>
        <p>{description}</p>
      </div>
    </div>
  </section>
);

export default CatalogueBanner;