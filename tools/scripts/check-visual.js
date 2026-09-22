/* Kiểm tra trực quan: Google Maps iframe + ảnh SVG danh mục mới. Chạy: npm run check:visual (trong tools/) */
const { chromium } = require('playwright');
const path = require('path');
// Mọi ảnh chụp ghi vào tools/artifacts/ (gitignored).
const OUT = path.join(__dirname, '..', 'artifacts');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // 1) Google Maps iframe
  await page.goto('http://localhost:3000/contact', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(9000);
  const map = page.locator('.map-embed');
  const mapCount = await map.count();
  const box = mapCount ? await map.boundingBox() : null;
  const src = mapCount ? await map.getAttribute('src') : null;
  console.log('map iframe count:', mapCount, '| box:', JSON.stringify(box), '| src:', src ? src.slice(0, 60) + '...' : null);
  // Lỗi load iframe?
  page.on('requestfailed', (r) => console.log('REQFAIL:', r.url().slice(0, 90), r.failure()?.errorText));
  await page.locator('.map-section').screenshot({ path: path.join(OUT, 'map-area.png') });
  console.log('map-area.png saved');

  // 2) SVG danh mục mới trên thẻ sản phẩm
  await page.goto('http://localhost:3000/san-pham?cat=ban-ghe', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.locator('.p-card').first().screenshot({ path: path.join(OUT, 'svg-card.png') });
  const bg = await page.$eval('.p-card .p-media-link', (el) => getComputedStyle(el).backgroundImage.slice(0, 90));
  console.log('card background:', bg);
  await browser.close();
  console.log('DONE');
})().catch((e) => { console.error('CHECK FAILED:', e.message); process.exit(1); });
