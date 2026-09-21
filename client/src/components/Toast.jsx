import React from 'react';
import { useCart } from '../context/CartContext';
import Icon from './Icon';

const Toast = () => {
  const { toast } = useCart();
  if (!toast) return null;
  const isError = toast.type === 'error';
  return (
    <div className={`toast${isError ? ' toast-error' : ''}`} key={toast.key} role="status" aria-live="polite">
      <span className="t-icon" aria-hidden="true">
        <Icon name={isError ? 'close' : 'check'} size={13} strokeWidth={2.6} />
      </span>
      <span>{toast.message}</span>
    </div>
  );
};

export default Toast;