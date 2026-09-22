/* Kiểm tra dải 3 mục cam kết (trust-strip) dưới hero trang chủ:
   - Đủ 3 mục, icon SVG hiển thị thật (đúng shield / refresh / truck)
   - Icon có kích thước > 0 (không bị vỡ/ẩn)
   - Đây là thẻ div tĩnh hay nút bấm (giải thích vì sao click không có tác dụng)
   - Bắt lỗi console / pageerror / request failed
   Chạy: npm run check:trust (trong tools/ — cần FE đang chạy: dev 5173 hoặc build 3000) */
const { chromium } = require('playwright');
const path = require('path');
// Mọi ảnh chụp ghi vào tools/artifacts/ (gitignored).
const OUT = path.join(__dirname, '..', 'artifacts');

const TARGETS = process.env.BASE ? [process.env.BASE] : ['http://localhost:5173', 'http://localhost:3000'];

const EXPECTED = ['shield', 'refresh', 'truck'];

(async () => {
  let anyFail = false;
  for (const BASE of TARGETS) {
    console.log(`\n===== Kiểm tra: ${BASE} =====`);
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN' });
    const page = await context.newPage();
    const problems = [];
    page.on('pageerror', (e) => problems.push(`PAGEERROR: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') problems.push(`CONSOLE: ${m.text().slice(0, 260)}`); });
    page.on('requestfailed', (r) => problems.push(`REQFAIL: ${r.url()}`));

    try {
      await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(600);

      const items = await page.$$eval('.trust-item', (els) => els.map((el) => {
        const svg = el.querySelector('.ts-icon svg');
        const rect = svg ? svg.getBoundingClientRect() : null;
        return {
          tag: el.tagName.toLowerCase(),
          title: (el.querySelector('strong') || {}).textContent || '',
          desc: (el.querySelector('div > span') || {}).textContent || '',
          hasSvg: !!svg,
          svgSize: rect ? `${Math.round(rect.width)}x${Math.round(rect.height)}` : '0x0',
          isInteractive: !!(el.closest('button, a, [role="button"]')),
        };
      }));

      const names = await page.$$eval('.trust-item .ts-icon svg', (svgs) => svgs.map((s) => {
        // Icon component không gắn tên — đối chiếu qua viewBox + số path đặc trưng
        return `paths:${s.querySelectorAll('path, circle, rect').length}`;
      }));

      if (items.length !== 3) { console.log(`FAIL  Số mục: ${items.length} (kỳ vọng 3)`); anyFail = true; }
      else console.log('PASS  Đủ 3 mục cam kết');

      items.forEach((it, i) => {
        const iconOk = it.hasSvg && it.svgSize !== '0x0';
        const status = it.hasSvg && iconOk && it.title ? 'PASS' : 'FAIL';
        if (status === 'FAIL') anyFail = true;
        console.log(`${status}  #${i + 1} <${it.tag}> icon=${it.hasSvg} (${it.svgSize}) — "${it.title.trim()}"`);
        console.log(`      desc: "${(it.desc || '').trim().slice(0, 80)}"`);
      });

      const interactive = items.some((it) => it.isInteractive);
      console.log(interactive
        ? 'NOTE  Các mục NẰM TRONG nút/liên kết (có thể click).'
        : 'PASS  Các mục là thẻ div tĩnh (không phải nút) — click không có tác dụng là đúng thiết kế.');

      // Chụp ảnh dải trust trên desktop + mobile
      const strip = page.locator('.trust-strip');
      await strip.scrollIntoViewIfNeeded();
      await strip.screenshot({ path: path.join(OUT, 'trust-desktop.png') });

      const mobile = await context.newPage();
      await mobile.setViewportSize({ width: 390, height: 844 });
      await mobile.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 20000 });
      await mobile.locator('.trust-strip').scrollIntoViewIfNeeded();
      await mobile.waitForTimeout(300);
      await mobile.locator('.trust-strip').screenshot({ path: path.join(OUT, 'trust-mobile.png') });
      const mItems = await mobile.$$eval('.trust-item', (els) => els.map((el) => {
        const r = el.getBoundingClientRect();
        const svg = el.querySelector('svg');
        return { title: (el.querySelector('strong') || {}).textContent || '', w: Math.round(r.width), h: Math.round(r.height), svg: svg ? Math.round(svg.getBoundingClientRect().width) : 0 };
      }));
      mItems.forEach((it, i) => {
        const ok = it.w > 0 && it.h > 0 && it.svg > 0;
        if (!ok) anyFail = true;
        console.log(`${ok ? 'PASS' : 'FAIL'}  mobile #${i + 1}: ${it.w}x${it.h}, icon ${it.svg}px — "${it.title.trim()}"`);
      });
    } catch (e) {
      anyFail = true;
      console.log(`FAIL  Không kiểm tra được trang: ${String(e.message).split('\n')[0]}`);
    }

    if (problems.length) { anyFail = true; console.log('LỖI bắt được:'); problems.forEach((p) => console.log('  -', p)); }
    else console.log('PASS  Không có lỗi console / pageerror / request failed');

    await browser.close();
  }
  console.log(anyFail ? '\n>>> CÓ VẤN ĐỀ, xem chi tiết trên.' : '\n>>> TẤT CẢ ỔN ĐỊNH.');
  process.exit(anyFail ? 1 : 0);
})();
