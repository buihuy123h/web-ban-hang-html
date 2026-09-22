import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        // Tách vendor (React + Router) thành chunk riêng có hash riêng: nội dung
        // gần như không đổi giữa các lần deploy → trình duyệt giữ cache, người
        // dùng quay lại chỉ tải lại code app thay vì cả bundle.
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  server: {
    port: 5173,
    // Trong lúc dev, mọi request /api/* và /images/* (ảnh sản phẩm do BE phục vụ)
    // được chuyển tiếp sang backend Express (cổng 3000).
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/images': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});

