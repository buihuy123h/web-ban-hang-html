/**
 * Lớp nền tảng để gọi REST API của backend.
 * - Mặc định dùng đường dẫn tương đối `/api` (đi qua proxy của Vite khi dev,
 *   và cùng origin khi production vì server Express serve kèm client build).
 * - Có thể trỏ sang backend riêng bằng biến môi trường VITE_API_URL.
 */
const API_BASE = import.meta.env.VITE_API_URL || '/api';

export class ApiError extends Error {
  constructor(message, status, fields) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fields = fields;
  }
}

const request = async (path, options = {}) => {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch {
    throw new ApiError('Không kết nối được máy chủ. Kiểm tra backend đã chạy chưa.', 0);
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = (data && (data.error || data.message)) || `Yêu cầu thất bại (${response.status}).`;
    throw new ApiError(message, response.status, data && data.fields);
  }
  return data;
};

export { request, API_BASE };
