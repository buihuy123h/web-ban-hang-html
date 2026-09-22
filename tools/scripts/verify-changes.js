/* Kiểm chứng các thay đổi: hero thấp hơn, trang /saved mới, trang /about mới.
   Chạy: npm run verify:changes (trong tools/ — cần server tại BASE, mặc định http://localhost:3000) */
const { chromium } = require('playwright');
const path = require('path');
// Mọi ảnh chụp ghi vào tools/artifacts/ (gitignored).
const OUT = path.join(__dirname, '..', 'artifacts');
const BASE = process.env.BASE || 'http://localhost:3000';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const problems = [];

  /* ===== Ctx 1: khách mới — kiểm tra hero + /saved trống + /about ===== */
  const ctx1 = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN' });
  const p1 = await ctx1.newPage();
  p1.on('pageerror', (e) => problems.push('PAGEERROR: ' + e.message));
  p1.on('console', (m) => { if (m.type() === 'error') problems.push('CONSOLE: ' + m.text().slice(0, 200)); });

  await p1.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
  await p1.waitForTimeout(800);
  const heroH = await p1.$eval('.hero', (el) => Math.round(el.getBoundingClientRect().height));
  console.log('HOME: chiều cao khối hero =', heroH, 'px (trước sửa ~850px)');
  await p1.screenshot({ path: path.join(OUT, 'verify-home.png') });

  await p1.goto(BASE + '/saved', { waitUntil: 'networkidle', timeout: 30000 });
  await p1.waitForTimeout(800);
  const hasSuggest = Boolean(await p1.$('.saved-suggest'));
  const chipCount = await p1.$$eval('.saved-chip', (els) => els.length);
  console.log('SAVED (trống): mục gợi ý bán chạy:', hasSuggest, '| chip danh mục:', chipCount);
  await p1.screenshot({ path: path.join(OUT, 'verify-saved-empty.png'), fullPage: true });

  await p1.goto(BASE + '/about', { waitUntil: 'networkidle', timeout: 30000 });
  await p1.waitForTimeout(800);
  const aboutText = await p1.textContent('main');
  console.log('ABOUT: câu chuyện mới:', aboutText.includes('Mua tận nơi, bán bằng giá thật.'),
    '| sticker kho:', aboutText.includes('Kho 707 Tân Sơn'),
    '| số link fanpage mới:', await p1.$$eval('a[href*="100090912844650"]', (els) => els.length));
  await p1.screenshot({ path: path.join(OUT, 'verify-about.png'), fullPage: true });
  await ctx1.close();

  /* ===== Ctx 2: lưu 3 món rồi vào /saved ===== */
  const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN' });
  const p2 = await ctx2.newPage();
  p2.on('pageerror', (e) => problems.push('PAGEERROR2: ' + e.message));
  p2.on('console', (m) => { if (m.type() === 'error') problems.push('CONSOLE2: ' + m.text().slice(0, 200)); });

  await p2.goto(BASE + '/san-pham', { waitUntil: 'networkidle', timeout: 30000 });
  await p2.waitForTimeout(800);
  const saves = await p2.$$('.p-save');
  for (let i = 0; i < 3; i++) { await saves[i].click(); await p2.waitForTimeout(250); }

  await p2.goto(BASE + '/saved', { waitUntil: 'networkidle', timeout: 30000 });
  await p2.waitForTimeout(800);
  const countText = await p2.textContent('.saved-count').catch(() => null);
  console.log('SAVED (có hàng):', countText ? countText.trim().replace(/\s+/g, ' ') : 'KHÔNG THẤY .saved-count',
    '| số thẻ sản phẩm:', await p2.$$eval('.product-grid .p-card', (els) => els.length));
  await p2.click('.saved-actions .btn-primary');
  await p2.waitForTimeout(600);
  console.log('SAVED: toast sau "Thêm tất cả vào giỏ":', Boolean(await p2.$('.toast')),
    '| số trong giỏ (navbar):', (await p2.textContent('.cart-btn strong').catch(() => '') || '').trim());
  await p2.screenshot({ path: path.join(OUT, 'verify-saved-filled.png'), fullPage: true });
  await ctx2.close();

  console.log(problems.length ? 'PROBLEMS:\n' + problems.join('\n') : 'NO CONSOLE/PAGE ERRORS');
  await browser.close();
  process.exit(problems.length ? 1 : 0);
})().catch((e) => { console.error('VERIFY CRASHED:', e); process.exit(2); });