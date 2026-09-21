import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getCategories, getProducts } from '../api/catalog';

/**
 * Nguồn dữ liệu danh mục/sản phẩm duy nhất cho toàn app.
 * Lấy từ backend API một lần khi mở trang, các trang chỉ cần dùng useCatalog().
 */
export const CatalogContext = createContext();

export const CatalogProvider = ({ children }) => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [categoryList, productList] = await Promise.all([getCategories(), getProducts()]);
      setCategories([{ key: 'all', label: 'Tất cả' }, ...categoryList]);
      setProducts(productList);
    } catch (err) {
      setError(err.message || 'Không tải được dữ liệu sản phẩm.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const value = useMemo(() => ({
    products,
    categories,
    loading,
    error,
    reload: load,
  }), [products, categories, loading, error, load]);

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
};

export const useCatalog = () => useContext(CatalogContext);
