/* Smoke test UI: mở từng trang, bấm mọi nút trong main, bắt lỗi console/pageerror.
   Chạy: npm run smoke (trong tools/ — cần server đang chạy tại BASE, mặc định http://localhost:3000) */
const { chromium } = require('playwright');
const path = require('path');
// Ảnh chụp ghi vào tools/artifacts/ (gitignored).
const OUT = path.join(__dirname, '..', 'artifacts');
const BASE = process.env.BASE || 'http://localhost:3000';

const results = [];
const note = (ok, msg) => { results.push({ ok, msg }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); };

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN' });
  const page = await context.newPage();
  const problems = [];
  page.on('pageerror', (e) => problems.push(`PAGEERROR @${page.url()}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`CONSOLE @${page.url()}: ${m.text().slice(0, 260)}`); });
  page.on('requestfailed', (r) => { if (!r.url().includes('facebook')) problems.push(`REQFAIL @${page.url()}: ${r.url()}`); });

  const visit = async (route) => { await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 20000 }); await page.waitForTimeout(600); };

  const clickMainButtons = async (route, label) => {
    await visit(route);
    const SEL = 'main button, main [role="button"], main details summary';
    const total = Math.min(await page.locator(SEL).count(), 20);
    for (let i = 0; i < total; i++) {
      try {
        // Query lại theo index mỗi lần bấm — React re-render sau mỗi click làm handle cũ vô hiệu.
        const btn = page.locator(SEL).nth(i);
        if (!(await btn.count())) break;
        await btn.click({ timeout: 2500 });
        await page.waitForTimeout(400);
      } catch (e) {
        note(false, `${label}: nút #${i} bấm lỗi → ${String(e.message).split('\n')[0].slice(0, 160)}`);
      }
      if (page.url() !== BASE + route) await visit(route); // nút điều hướng thì quay lại
    }
    return total;
  };

  // 1) Bấm toàn bộ nút theo trang
  for (const [route, label] of [['/', 'Trang chủ'], ['/san-pham', 'Sản phẩm'], ['/product/1', 'Chi tiết'], ['/saved', 'Đã lưu'], ['/about', 'Giới thiệu'], ['/contact', 'Liên hệ'], ['/cart', 'Giỏ hàng (trống)']]) {
    const n = await clickMainButtons(route, label);
    note(true, `${label}: đã bấm ${n} nút/summary`);
  }

  // 2) Luồng thêm vào giỏ từ thẻ sản phẩm
  await visit('/san-pham');
  const addButtons = await page.$$('.p-add');
  await addButtons[0].click();
  await page.waitForTimeout(500);
  const toast = await page.$('.toast');
  note(Boolean(toast), 'Thêm vào giỏ hiện toast');
  await page.click('.cart-btn');
  await page.waitForTimeout(700);
  const itemCount = await page.$$eval('.cart-item', (els) => els.length).catch(() => 0);
  note(itemCount > 0, `Giỏ hàng có ${itemCount} dòng sau khi thêm`);

  // 3) Đặt hàng end-to-end
  const fillSelector = async (sel, value) => { await page.fill(sel, value); };
  try {
    await page.fill('input[name="name"], input[autocomplete="name"]', 'Nguyen Van A');
    await page.fill('input[type="tel"]', '0901234567');
    await page.fill('textarea[name="address"], input[name="address"], input[autocomplete="street-address"]', '25 Ly Thuong Kiet, Quan 1, TP.HCM');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);
    const success = await page.$('.order-success');
    note(Boolean(success), success ? `Đặt hàng OK (${(await page.textContent('.order-reference') || '').trim()})` : 'Đặt hàng KHÔNG hiện trang thành công');
  } catch (e) {
    note(false, `Luồng đặt hàng lỗi: ${String(e.message).split('\n')[0].slice(0, 200)}`);
  }

  // 4) Số lượng + lưu sản phẩm ở trang chi tiết
  await visit('/product/2');
  await page.click('[aria-label="Tăng số lượng"]');
  await page.click('[aria-label="Tăng số lượng"]');
  const qtyText = await page.textContent('.qty-picker span');
  note(qtyText.trim() === '3', `Tăng số lượng lên 3 (thấy: ${qtyText.trim()})`);
  await page.click('button.btn-primary');
  await page.waitForTimeout(400);
  note(Boolean(await page.$('.toast')), 'Thêm vào giỏ từ chi tiết hiện toast');

  // 5) Mobile viewport — menu & nút chính hiển thị
  await page.setViewportSize({ width: 390, height: 844 });
  await visit('/');
  const navVisible = await page.isVisible('.nav-links');
  note(navVisible, 'Mobile: nav-links hiển thị (không cần hamburger)');
  const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
  note(!overflowX, overflowX ? 'Mobile: TRÀN NGANG trang!' : 'Mobile: không tràn ngang');

  // 6) Ảnh chụp toàn bộ trang để kiểm tra trực quan
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const r of ['/', '/san-pham', '/product/1', '/contact', '/cart', '/about']) {
    await visit(r);
    await page.screenshot({ path: path.join(OUT, `shot${r === '/' ? '-home' : r.replaceAll('/', '-')}.png`), fullPage: true });
  }
  note(true, 'Đã chụp ảnh mọi trang (tools/shot-*.png)');

  problems.forEach((p) => note(false, p));
  const fails = results.filter((r) => !r.ok).length;
  console.log(`\n=== SMOKE: ${results.length - fails}/${results.length} PASS ===`);
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('SMOKE CRASHED:', e); process.exit(2); });
