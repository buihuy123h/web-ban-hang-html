/* Debug nhanh style thẻ sản phẩm. Chạy: npm run debug:style (trong tools/) */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3000/san-pham?cat=ban-ghe', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  const info = await page.evaluate(() => {
    const el = document.querySelector('.p-card .p-media-link');
    if (!el) return { found: false };
    return {
      found: true,
      style: (el.getAttribute('style') || '').slice(0, 400),
      computed: getComputedStyle(el).backgroundImage.slice(0, 120),
    };
  });
  console.log(JSON.stringify(info, null, 2));
  const jsName = await page.evaluate(() => [...document.scripts].map((s) => s.src).join(','));
  console.log('scripts:', jsName);
  await browser.close();
})().catch((e) => { console.error('DEBUG FAILED:', e.message); process.exit(1); });
