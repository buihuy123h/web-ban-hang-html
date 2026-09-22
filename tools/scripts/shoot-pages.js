/* Chụp full-page mọi trang chính. Chạy: npm run shoot (trong tools/ — output vào artifacts/)

   QUAN TRỌNG: trang dùng scroll-reveal (animation-timeline: view() — xem
   App.css) nên BẮT BUỘC quét cuộn qua trang trước khi chụp. Playwright chụp
   full-page bằng cách ghép nội dung ngoài màn hình mà KHÔNG cuộn thật, nên
   các khối .reveal chưa từng vào viewport sẽ bị chụp ở trạng thái opacity: 0
   (trông như mất nội dung, trong khi người dùng thật cuộn tới vẫn thấy). */
const { chromium } = require('playwright');
const path = require('path');
// Mọi ảnh chụp ghi vào tools/artifacts/ (gitignored).
const OUT = path.join(__dirname, '..', 'artifacts');

const pages = [
  ['home', '/'],
  ['products', '/san-pham'],
  ['detail', '/product/1'],
  ['cart', '/cart'],
  ['about', '/about'],
  ['contact', '/contact'],
];

/* Cuộn tuần tự từ trên xuống đáy trang như người đọc thật để mọi hiệu ứng
   reveal chạy đủ (đồng thời kích ảnh lazy-load), rồi ghim trạng thái hiển thị
   trước khi chụp full-page. Trả về opacity của .reveal đầu tiên đo ở đáy trang
   để log kiểm chứng (kỳ vọng "1"; "n/a" nếu trang không dùng .reveal). */
async function sweepAndReveal(page) {
  await page.evaluate(async () => {
    const step = Math.max(320, Math.floor(window.innerHeight * 0.8));
    const bottom = () => document.documentElement.scrollHeight - window.innerHeight;
    for (let y = 0; y <= bottom(); y += step) {
      window.scrollTo({ top: y, behavior: 'instant' });
      await new Promise((resolve) => setTimeout(resolve, 90));
    }
    window.scrollTo({ top: bottom(), behavior: 'instant' });
    await new Promise((resolve) => setTimeout(resolve, 250));
  });
  const check = await page.evaluate(() => {
    const el = document.querySelector('.reveal');
    return el ? getComputedStyle(el).opacity : 'n/a';
  });
  // Ghim trạng thái cuối: full-page screenshot không cuộn thật nên các khối
  // .reveal ngoài viewport sẽ không tự bật hiện nếu không ghim trước khi chụp.
  await page.addStyleTag({ content: '.reveal { animation: none !important; opacity: 1 !important; transform: none !important; }' });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(300);
  return check;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  for (const [name, path] of pages) {
    await page.goto('http://localhost:3000' + path, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1600);
    const revealCheck = await sweepAndReveal(page);
    await page.screenshot({ path: path.join(OUT, `cur-${name}.png`), fullPage: true });
    console.log(`cur-${name}.png saved (reveal: ${revealCheck})`);
  }
  // Mobile home
  const m = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await m.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await m.waitForTimeout(1500);
  const mobileCheck = await sweepAndReveal(m);
  await m.screenshot({ path: path.join(OUT, 'cur-mobile-home.png'), fullPage: true });
  console.log(`cur-mobile-home.png saved (reveal: ${mobileCheck})`);
  await browser.close();
  console.log('DONE');
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });

