import { request } from './client';

/** Danh sách danh mục sản phẩm. */
export const getCategories = () => request('/categories');

/** Danh sách sản phẩm. Hỗ trợ tuỳ chọn: { cat, q, sort }. */
export const getProducts = (params = {}) => {
  const search = new URLSearchParams();
  if (params.cat && params.cat !== 'all') search.set('cat', params.cat);
  if (params.q && String(params.q).trim()) search.set('q', params.q.trim());
  if (params.sort && params.sort !== 'popular') search.set('sort', params.sort);
  const qs = search.toString();
  return request(`/products${qs ? `?${qs}` : ''}`);
};

/** Chi tiết một sản phẩm: { product, related }. */
export const getProduct = (id) => request(`/products/${id}`);
