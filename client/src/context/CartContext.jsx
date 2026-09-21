import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export const CartContext = createContext();
const CART_KEY = 'inox-cart-v2';
const SAVED_KEY = 'inox-saved-v1';

const readStorage = (key, fallback = []) => {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : fallback;
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
};

export const CartProvider = ({ children }) => {
  const [items, setItems] = useState(() => readStorage(CART_KEY)
    .filter((item) => item && Number.isInteger(item.id) && typeof item.name === 'string' && Number(item.price) >= 0)
    .map((item) => ({ ...item, price: Number(item.price), qty: Math.max(1, Math.floor(Number(item.qty) || 1)) })));
  const [savedIds, setSavedIds] = useState(() => [...new Set(readStorage(SAVED_KEY).filter(Number.isInteger))]);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    try { localStorage.setItem(CART_KEY, JSON.stringify(items)); } catch { /* Storage may be unavailable. */ }
  }, [items]);

  useEffect(() => {
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(savedIds)); } catch { /* Storage may be unavailable. */ }
  }, [savedIds]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(timer);
  }, [toast]);

  const showToast = useCallback((message, type = 'ok') => setToast({ message, type, key: Date.now() }), []);
  const addToCart = useCallback((product, qty = 1) => {
    const safeQty = Math.max(1, Math.floor(Number(qty) || 1));
    setItems((prev) => {
      const found = prev.find((item) => item.id === product.id);
      if (found) return prev.map((item) => item.id === product.id ? { ...item, qty: item.qty + safeQty } : item);
      return [...prev, { id: product.id, name: product.name, price: product.price, qty: safeQty }];
    });
  }, []);
  const updateQty = useCallback((id, delta) => {
    const safeDelta = Number(delta) || 0;
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, qty: Math.max(1, item.qty + safeDelta) } : item));
  }, []);
  const removeFromCart = useCallback((id) => setItems((prev) => prev.filter((item) => item.id !== id)), []);
  const clearCart = useCallback(() => setItems([]), []);
  const toggleSaved = useCallback((id) => {
    setSavedIds((prev) => prev.includes(id) ? prev.filter((savedId) => savedId !== id) : [...prev, id]);
  }, []);
  const isSaved = useCallback((id) => savedIds.includes(id), [savedIds]);

  const value = useMemo(() => ({
    items,
    addToCart,
    updateQty,
    removeFromCart,
    clearCart,
    cartCount: items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0),
    cartTotal: items.reduce((sum, item) => sum + (Number(item.qty) || 0) * (Number(item.price) || 0), 0),
    savedIds,
    savedCount: savedIds.length,
    toggleSaved,
    isSaved,
    toast,
    showToast,
  }), [items, savedIds, toggleSaved, isSaved, toast, showToast]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => useContext(CartContext);
