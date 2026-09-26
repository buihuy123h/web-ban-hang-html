import React from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';

const Breadcrumbs = ({ items = [] }) => (
  <nav className="breadcrumbs" aria-label="Đường dẫn">
    <ol className="breadcrumbs-list">
      <li className="breadcrumbs-item">
        <Link to="/" className="breadcrumbs-home">
          <Icon name="home" size={14} aria-hidden="true" />
          <span>Trang chủ</span>
        </Link>
      </li>
      {items.map((item, index) => {
        const isCurrent = index === items.length - 1;
        return (
          <li className="breadcrumbs-item" key={`${item.label}-${index}`}>
            <Icon name="arrowRight" size={12} className="breadcrumbs-separator" aria-hidden="true" />
            {isCurrent || !item.to ? (
              <span className={isCurrent ? 'breadcrumbs-current' : undefined} aria-current={isCurrent ? 'page' : undefined}>
                {item.label}
              </span>
            ) : (
              <Link to={item.to}>{item.label}</Link>
            )}
          </li>
        );
      })}
    </ol>
  </nav>
);

export default Breadcrumbs;