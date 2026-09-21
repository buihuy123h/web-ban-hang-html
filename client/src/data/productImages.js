import cookwareImage from '../assets/inox-editorial-hero.png';
import tablewareImage from '../assets/category-tableware.jpg';
import toolsImage from '../assets/category-tools.jpg';
import storageImage from '../assets/category-storage.jpg';

export const categoryImages = {
  'noi-chao': cookwareImage,
  'bat-dia': tablewareImage,
  'dung-cu': toolsImage,
  'luu-tru': storageImage,
};

export const categoryImagePositions = {
  'noi-chao': ['72% 50%', '90% 56%', '48% 60%'],
  'bat-dia': ['50% 52%', '30% 50%', '72% 48%'],
  'dung-cu': ['50% 54%', '70% 58%', '30% 52%'],
  'luu-tru': ['50% 52%', '70% 48%', '28% 56%'],
};

export const getProductImage = (product) => categoryImages[product.category] ?? cookwareImage;

export const getProductPosition = (product, view = 0) => {
  const positions = categoryImagePositions[product.category] ?? categoryImagePositions['noi-chao'];
  return positions[(product.id + view - 1) % positions.length];
};
