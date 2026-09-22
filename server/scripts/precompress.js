/**
 * Precompress — nén sẵn file tĩnh của bản build client thành .br (Brotli) và .gz (gzip).
 *
 * Vì sao: server Express mặc định KHÔNG nén file tĩnh (js/css/svg). Bundle ~235KB
 * đi trên mạng nguyên bản trong khi Brotli chỉ còn ~60-70KB → tải trang chậm hơn 3-4 lần.
 * Nén sẵn lúc build nhanh hơn và nén gọn hơn nén từng-request lúc chạy.
 *
 * - Chỉ nén loại file văn bản (js/css/html/svg/json/...), bỏ qua ảnh/video đã nén sẵn.
 * - Idempotent: file .br/.gz còn mới hơn bản gốc thì bỏ qua → chạy lại rất rẻ.
 * - Không có client/dist thì thoát 0 (an toàn khi chạy trên máy CI chưa build).
 *
 * Chạy: node scripts/precompress.js [thư-mục-dist]
 * (deploy.ps1 tự chạy sau bước build; server.js cũng tự chạy 1 lần khi khởi động nếu thiếu.)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const COMPRESSIBLE = new Set([
  '.html', '.js', '.mjs', '.css', '.json', '.svg', '.txt', '.xml', '.map', '.webmanifest',
]);
const MIN_BYTES = 1024; // Dưới 1KB: nén không đáng (chi phíheader > lợi ích).
const BROTLI_OPTS = { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: zlib.constants.BROTLI_MAX_QUALITY } };
const GZIP_OPTS = { level: zlib.constants.Z_BEST_COMPRESSION };

const formatBytes = (n) => {
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
};

/**
 * Duyệt distDir, sinh file .br / .gz cạnh file gốc.
 * Trả về { created, skipped, savedBr, savedGz } để CLI báo cáo.
 */
const precompress = (distDir, log = () => {}) => {
  const result = { created: 0, skipped: 0, savedBr: 0, savedGz: 0 };
  if (!fs.existsSync(distDir)) return result;

  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!COMPRESSIBLE.has(path.extname(entry.name).toLowerCase())) continue;
      const stat = fs.statSync(full);
      if (stat.size < MIN_BYTES) continue;

      for (const [ext, compress, opts] of [
        ['.br', zlib.brotliCompressSync, BROTLI_OPTS],
        ['.gz', zlib.gzipSync, GZIP_OPTS],
      ]) {
        const target = `${full}${ext}`;
        if (fs.existsSync(target) && fs.statSync(target).mtimeMs >= stat.mtimeMs) {
          result.skipped += 1;
          continue;
        }
        const packed = compress.call(zlib, fs.readFileSync(full), opts);
        fs.writeFileSync(target, packed);
        result.created += 1;
        if (ext === '.br') result.savedBr += stat.size - packed.length;
        else result.savedGz += stat.size - packed.length;
      }
    }
  };

  walk(distDir);
  return result;
};

module.exports = { precompress, formatBytes, COMPRESSIBLE };

/* CLI: node scripts/precompress.js */
if (require.main === module) {
  const distDir = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.resolve(__dirname, '..', '..', 'client', 'dist');

  if (!fs.existsSync(distDir)) {
    console.log(`[precompress] Bỏ qua: chưa có bản build tại ${distDir} (chạy "npm run build" trong client/).`);
    process.exit(0);
  }

  const r = precompress(distDir, console.log);
  console.log(`[precompress] ${distDir}`);
  console.log(`  Tạo mới: ${r.created} bản nén · Bỏ qua (đã mới nhất): ${r.skipped}`);
  if (r.created > 0) {
    console.log(`  Tiết kiệm dung lượng truyền: Brotli ${formatBytes(r.savedBr)} · Gzip ${formatBytes(r.savedGz)}`);
  } else {
    console.log('  Mọi file đã được nén sẵn — không cần làm gì.');
  }
}
