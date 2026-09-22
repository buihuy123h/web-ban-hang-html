/* Chụp nhanh bộ nút liên hệ nổi (ContactFab) để kiểm tra trực quan.
   Chạy: npm run verify:fab (trong tools/ — cần server đang chạy tại localhost:3000) */
const { chromium } = require('playwright');
const path = require('path');
// Mọi ảnh chụp ghi vào tools/artifacts/ (gitignored).
const OUT = path.join(__dirname, '..', 'artifacts');

(async () => {
  const browser = await chromium.launch({ headless: true });

  // Desktop — home: đóng rồi mở menu
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, 'fab-home-closed.png') });

  await page.click('.cf-toggle');
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, 'fab-home-open.png') });

  const links = await page.$$eval('.cf-link', (as) => as.map((a) => a.getAttribute('href')));
  console.log('FAB links:', JSON.stringify(links, null, 1));
  await page.close();

  // Desktop — trang liên hệ (kênh hỗ trợ + FAB)
  const c = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await c.goto('http://localhost:3000/contact', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await c.waitForTimeout(1200);
  await c.evaluate(() => window.scrollTo(0, 420));
  await c.waitForTimeout(400);
  await c.screenshot({ path: path.join(OUT, 'fab-contact.png') });
  await c.close();

  // Desktop — cuộn xuống (back-to-top hiện ra) rồi mở menu:
  // nút back-to-top phải tự ẩn đi để không bị bubble "Gọi điện" đè lên
  const s = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await s.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await s.waitForTimeout(1200);
  await s.evaluate(() => window.scrollTo(0, 1200));
  await s.waitForTimeout(500);
  const bttClosed = await s.$eval('.back-to-top', (el) => getComputedStyle(el).opacity).catch(() => 'missing');
  await s.click('.cf-toggle');
  await s.waitForTimeout(700);
  const bttOpen = await s.$eval('.back-to-top', (el) => getComputedStyle(el).opacity).catch(() => 'missing');
  console.log(`Back-to-top opacity — menu đóng: ${bttClosed} | menu mở: ${bttOpen}`);
  await s.screenshot({ path: path.join(OUT, 'fab-desktop-scrolled-open.png') });
  await s.close();

  // Mobile — home: đóng rồi mở
  const m = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await m.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await m.waitForTimeout(1500);
  await m.screenshot({ path: path.join(OUT, 'fab-mobile-closed.png') });
  await m.tap('.cf-toggle');
  await m.waitForTimeout(700);
  await m.screenshot({ path: path.join(OUT, 'fab-mobile-open.png') });
  await m.close();

  await browser.close();
  console.log('DONE');
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });