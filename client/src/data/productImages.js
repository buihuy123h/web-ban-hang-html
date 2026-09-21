import cookwareImage from '../assets/inox-editorial-hero.png';
import tablewareImage from '../assets/category-tableware.jpg';
import toolsImage from '../assets/category-tools.jpg';
import storageImage from '../assets/category-storage.jpg';
// Dùng new URL() để Vite luôn emit SVG thành file riêng (SVG <4KB bị inline data-URI
// chứa khoảng trắng → khai báo url(...) trong inline style trở nên invalid).
const chairsImage = new URL('../assets/category-banghe.svg', import.meta.url).href;
const furnitureImage = new URL('../assets/category-noithat.svg', import.meta.url).href;

export const categoryImages = {
  'ban-ghe': chairsImage,
  'noi-that': furnitureImage,
  'noi-chao': cookwareImage,
  'bat-dia': tablewareImage,
  'dung-cu': toolsImage,
  'luu-tru': storageImage,
};

export const categoryImagePositions = {
  'ban-ghe': ['50% 50%', '50% 50%', '50% 50%'],
  'noi-that': ['50% 50%', '50% 50%', '50% 50%'],
  'noi-chao': ['72% 50%', '90% 56%', '48% 60%'],
  'bat-dia': ['50% 52%', '30% 50%', '72% 48%'],
  'dung-cu': ['50% 54%', '70% 58%', '30% 52%'],
  'luu-tru': ['50% 52%', '70% 48%', '28% 56%'],
};

export const getProductImage = (product) => categoryImages[product.category] ?? cookwareImage;

// SVG minh họa cần hiển thị trọn khung; ảnh photo giữ zoom editorial 340% như thiết kế gốc.
const ILLUSTRATION_CATEGORIES = new Set(['ban-ghe', 'noi-that']);
export const getProductBackgroundSize = (product) =>
  ILLUSTRATION_CATEGORIES.has(product.category) ? 'cover' : '340% auto';

export const getProductPosition = (product, view = 0) => {
  const positions = categoryImagePositions[product.category] ?? categoryImagePositions['noi-chao'];
  return positions[(product.id + view - 1) % positions.length];
};
