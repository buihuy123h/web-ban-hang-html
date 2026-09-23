import { request } from './client';

/**
 * Trợ lý AI chat (RAG) — gửi hội thoại tới POST /api/chat.
 * Trả về { reply: string, mode: 'ai' | 'fallback', products: [{id, name, price}] }.
 * Lỗi hợp lệ (429 nhắn nhanh, 400 sai dữ liệu, 5xx…) → ApiError với message
 * tiếng Việt sẵn dùng để hiển thị cho khách.
 */
export const sendChat = (messages) => request('/chat', {
  method: 'POST',
  body: JSON.stringify({ messages }),
});