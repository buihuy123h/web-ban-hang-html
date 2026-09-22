/* Probe tạm: kiểm chứng .reveal (scroll-driven animation) — chạy: npm run probe:reveal (trong tools/) */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(800);

  const supports = await page.evaluate(() => CSS.supports('animation-timeline: view()'));
  const atTop = await page.$eval('.std-card', (el) => getComputedStyle(el).opacity);

  // Cuộn như người thật (instant để bỏ qua scroll-behavior: smooth)
  await page.evaluate(() => {
    document.querySelector('.standards').scrollIntoView({ behavior: 'instant', block: 'center' });
  });
  await page.waitForTimeout(600);
  const scrolled = await page.$eval('.std-card', (el) => getComputedStyle(el).opacity);

  // Cuộn về đầu → reveal kiểu "entry" sẽ mờ đi lần nữa (đúng thiết kế)
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(600);
  const backTop = await page.$eval('.std-card', (el) => getComputedStyle(el).opacity);

  console.log(JSON.stringify({ supports, opacityAtTop: atTop, opacityAfterScroll: scrolled, opacityBackToTop: backTop }));
  await browser.close();
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
