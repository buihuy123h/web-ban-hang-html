const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(process.env.BASE || 'http://localhost:3000/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'artifacts/home-now.png', fullPage: true });
  await browser.close();
  console.log('OK');
})();
