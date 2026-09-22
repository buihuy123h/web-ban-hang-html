/**
 * Bản đồ ảnh cho sản phẩm & danh mục.
 *
 * Từ nay TOÀN BỘ ảnh nằm ở BE: `server/public/images/` (catalog/ = ảnh danh mục & hero,
 * products/ = ảnh riêng từng món). DB (server/data/products.json) chỉ lưu ĐƯỜNG DẪN
 * TƯƠNG ĐỐI dạng "/images/..." — nhờ vậy:
 *  - Lên mạng, đổi domain, deploy nơi khác: ảnh vẫn chạy, không phải sửa DB.
 *  - Thêm/đổi ảnh không phải build lại FE — chỉ chép file + sửa products.json.
 *  - Server phục vụ /images với cache 30 ngày immutable (tên file không bao giờ bị ghi đè).
 * Chi tiết cách tổ chức: server/docs/DATABASE.md
 */
import { API_BASE } from '../api/client';

// BE có thể chạy origin khác (VITE_API_URL=...): tách gốc server từ URL API.
// '/api' (mặc định — đi qua proxy lúc dev, cùng origin lúc production) → IMG_BASE rỗng.
const IMG_BASE = API_BASE === '/api' ? '' : API_BASE.replace(/\/api\/?$/, '');

/**
 * Chuyển đường dẫn ảnh trong DB thành URL dùng được:
 *  - "/images/x.jpg" → IMG_BASE + "/images/x.jpg" (ảnh do BE phục vụ)
 *  - "https://..."   → giữ nguyên (ảnh CDN/Internet — FE không tự kiểm tra được)
 *  - rỗng            → '' (caller tự chọn ảnh fallback)
 */
export const resolveImg = (path) => {
  if (!path) return '';
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  if (path.startsWith('/')) return `${IMG_BASE}${path}`;
  return path;
};

// Phương tiện cuối cùng khi mọi fallback đều hỏng (SVG data-URI — không cần mạng).
export const IMG_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%23e9e2d0'/%3E%3C/svg%3E";

export const categoryImages = {
  'ban-ghe': resolveImg('/images/catalog/ban-ghe.svg'),
  'noi-that': resolveImg('/images/catalog/noi-that.svg'),
  'noi-chao': resolveImg('/images/catalog/noi-chao.jpg'),
  'bat-dia': resolveImg('/images/catalog/bat-dia.jpg'),
  'dung-cu': resolveImg('/images/catalog/dung-cu.jpg'),
  'luu-tru': resolveImg('/images/catalog/luu-tru.jpg'),
};

// Hero trang chủ dùng đúng file ảnh nồi/chảo (được preload trong client/index.html).
export const HERO_IMAGE = categoryImages['noi-chao'];

export const categoryImagePositions = {
  'ban-ghe': ['50% 50%', '50% 50%', '50% 50%'],
  'noi-that': ['50% 50%', '50% 50%', '50% 50%'],
  'noi-chao': ['72% 50%', '90% 56%', '48% 60%'],
  'bat-dia': ['50% 52%', '30% 50%', '72% 48%'],
  'dung-cu': ['50% 54%', '70% 58%', '30% 52%'],
  'luu-tru': ['50% 52%', '70% 48%', '28% 56%'],
};

/** Sản phẩm có ảnh riêng trong DB hay không (không có thì "mượn" ảnh danh mục). */
export const hasOwnPhoto = (product) => Boolean(product && product.image);

/** Ảnh đại diện: ảnh riêng trong DB (nếu có) → ảnh danh mục → ảnh nồi/chảo. */
export const getProductImage = (product) => {
  if (hasOwnPhoto(product)) return resolveImg(product.image);
  return categoryImages[product && product.category] ?? categoryImages['noi-chao'];
};

/** Gallery ảnh riêng của sản phẩm (đã resolve); rỗng nếu chưa khai báo. */
export const getProductGallery = (product) =>
  product && Array.isArray(product.images) ? product.images.map(resolveImg).filter(Boolean) : [];

/** Ảnh cho "góc xem" thứ view: có gallery thì theo gallery, không thì ảnh chính/danh mục. */
export const getViewImage = (product, view = 0) => {
  const gallery = getProductGallery(product);
  if (gallery.length) return gallery[((view % gallery.length) + gallery.length) % gallery.length];
  return getProductImage(product);
};

// SVG minh họa cần hiển thị trọn khung; ảnh photo giữ zoom editorial 340% như thiết kế gốc.
// Sản phẩm có ảnh RIÊNG trong DB → hiện cover như ảnh thương mại điện tử bình thường.
const ILLUSTRATION_CATEGORIES = new Set(['ban-ghe', 'noi-that']);
export const getProductBackgroundSize = (product) => {
  if (hasOwnPhoto(product)) return 'cover';
  return ILLUSTRATION_CATEGORIES.has(product && product.category) ? 'cover' : '340% auto';
};

export const getProductPosition = (product, view = 0) => {
  if (hasOwnPhoto(product)) return '50% 50%';
  const positions = categoryImagePositions[product && product.category] ?? categoryImagePositions['noi-chao'];
  return positions[(product.id + view - 1) % positions.length];
};

/** Fallback nhiều tầng cho <img onError>: ảnh riêng lỗi → ảnh thay thế → placeholder. */
export const handleImgError = (event, fallbackSrc) => {
  const img = event.currentTarget;
  if (img.dataset.fb) {
    img.src = IMG_PLACEHOLDER;
    return;
  }
  img.dataset.fb = '1';
  img.src = fallbackSrc || IMG_PLACEHOLDER;
};
