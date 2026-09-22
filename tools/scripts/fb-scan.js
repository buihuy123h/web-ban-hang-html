/* Quét Facebook page "Đồ Cũ Quang Huy" khi chưa đăng nhập: text + ảnh chụp.
   Chạy: npm run scan:fb (trong tools/ — output vào artifacts/) */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
// File dump ghi vào tools/artifacts/ (gitignored).
const OUT = path.join(__dirname, '..', 'artifacts');

const dump = async (page, url, name) => {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(7000);
    // Thử đóng các dialog cookie / đăng nhập
    for (const name_ of ['Cho phép tất cả cookie', 'Allow all cookies', 'Chỉ cho phép cookie thiết yếu', 'Allow essential and optional cookies', 'Từ chối cookie không thiết yếu']) {
      try {
        const b = page.getByRole('button', { name: name_ });
        if (await b.count()) { await b.first().click({ timeout: 2500 }); await page.waitForTimeout(2000); }
      } catch { /* bỏ qua */ }
    }
    for (const sel of ['[aria-label="Đóng"]', '[aria-label="Close"]']) {
      try {
        const b = await page.$(sel);
        if (b) { await b.click({ timeout: 2000 }); await page.waitForTimeout(1500); }
      } catch { /* bỏ qua */ }
    }
    for (let i = 0; i < 10; i++) {
      await page.mouse.wheel(0, 2200);
      await page.waitForTimeout(1600);
    }
    const text = await page.evaluate(() => document.body.innerText);
    fs.writeFileSync(path.join(OUT, `fb-${name}.txt`), text, 'utf8');
    await page.screenshot({ path: path.join(OUT, `fb-${name}.png`) });
    console.log(`${name}: ${text.length} chars → fb-${name}.txt / .png`);
    return text;
  } catch (e) {
    console.log(`${name} THẤT BẠI: ${String(e.message).split('\n')[0]}`);
    return '';
  }
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 950 },
    locale: 'vi-VN',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();
  const base = 'https://www.facebook.com/ocuquanghuy/';
  const home = await dump(page, base, 'home');
  await dump(page, base + 'about', 'about');
  await dump(page, base + 'photos', 'photos');
  await dump(page, base + 'shop/', 'shop');
  console.log('\n--- 1200 ký tự đầu của trang chính ---\n' + home.slice(0, 1200));
  await browser.close();
})().catch((e) => { console.error('FB SCAN CRASHED:', e.message); process.exit(1); });
