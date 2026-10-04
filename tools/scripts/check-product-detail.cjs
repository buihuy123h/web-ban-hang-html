/* QA trang chi tiết; chạy bản build bằng server fixture, không ghi dữ liệu runtime. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const BASE = process.env.BASE || 'http://localhost:3100';
const OUT = path.join(__dirname, '..', 'artifacts');
const results = [];
const problems = [];
const environment = [];
const watch = (page, errors) => {
  page.on('pageerror', e => errors.push(e.message));
  page.on('requestfailed', r => {
    if (r.url().startsWith('https://fonts.googleapis.com/') && r.failure()?.errorText === 'net::ERR_NETWORK_ACCESS_DENIED') environment.push({ url: r.url(), failure: r.failure() });
  });
  page.on('console', m => {
    if (m.type() !== 'error') return;
    if (m.location().url.startsWith('https://fonts.googleapis.com/') && m.text().includes('ERR_NETWORK_ACCESS_DENIED')) return;
    errors.push({ text: m.text(), location: m.location() });
  });
};
const check = async (name, fn) => {
  try { const evidence = await fn(); results.push({ name, pass: true, evidence }); console.log('PASS', name, evidence || ''); }
  catch (error) { results.push({ name, pass: false, error: error.message }); console.log('FAIL', name, error.message); }
};
const visit = async (page, id) => {
  await page.goto(`${BASE}/product/${id}`, { waitUntil: 'networkidle' });
  await page.locator('main h1').waitFor();
};
const imgOK = async (page) => page.locator('.detail-media img').evaluate(img => img.complete && img.naturalWidth > 0);
const layout = async page => page.evaluate(() => {
  const media = document.querySelector('.detail-media').getBoundingClientRect();
  const info = document.querySelector('.detail-info').getBoundingClientRect();
  const add = document.querySelector('.detail-add').getBoundingClientRect();
  const qty = document.querySelector('.qty-picker button').getBoundingClientRect();
  return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, media: { x: media.x, y: media.y, width: media.width }, info: { x: info.x, y: info.y, width: info.width }, add: { width: add.width, height: add.height }, qty: { width: qty.width, height: qty.height }, sticky: getComputedStyle(document.querySelector('.detail-info')).position };
});
const shoot = async (page, name) => {
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo({ top: y, behavior: 'instant' }); await new Promise(r => setTimeout(r, 750)); } scrollTo({ top: 0, behavior: 'instant' }); });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, name), fullPage: true });
};
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const products = await fetch(`${BASE}/api/products`).then(r => r.json());
  const categories = await fetch(`${BASE}/api/categories`).then(r => r.json());
  const product = products.find(p => p.id === 19);
  assert(product, 'Cần product 19 để kiểm ảnh riêng');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'vi-VN' });
  const page = await context.newPage();
  watch(page, problems);
  await visit(page, 19);
  await check('AC1 desktop / identity / image / breadcrumb', async () => {
    const l = await layout(page); assert(l.media.x < l.info.x); assert(Math.abs(l.media.y - l.info.y) < 2);
    assert.equal(await page.locator('[aria-current="page"]').innerText(), product.name);
    assert.equal(await page.locator('.detail-media img').getAttribute('alt'), product.name);
    assert(await imgOK(page)); assert(!/thegioitramhuong|Thế Giới Trầm Hương/i.test(await page.locator('main').innerText()));
    await shoot(page, 'product-detail-desktop.png'); return l;
  });
  await check('AC2 decision content order / discount / exact data', async () => {
    assert.equal(await page.locator('#product-title').innerText(), product.name);
    assert.equal(await page.locator('.d-desc').innerText(), product.description);
    assert.equal(await page.locator('.d-specs li').count(), product.specs.length);
    const order = await page.locator('.detail-info').evaluate(el => [...el.children].map(c => c.className || c.tagName));
    assert.deepEqual(order, ['p-cat', 'H1', 'd-meta', 'd-price-row', 'd-desc', 'd-specs', 'd-actions', 'detail-save ']);
    assert.equal(await page.locator('.d-discount').count(), 1); return order;
  });
  await check('AC8 text contrast AA / header clearance', async () => {
    const evidence = await page.evaluate(() => {
      const rgb = color => (color.match(/[\d.]+/g) || []).map(Number).slice(0, 3);
      const luminance = color => rgb(color).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
      const selectors = ['#product-title', '.d-price', '.d-desc', '.d-meta', '.in-stock', '.d-specs li', '.detail-save', '.detail-add', '.d-discount', '.delivery-note strong', '.delivery-note > span:last-child', '.product-disclosures summary'];
      const contrast = selectors.map(selector => {
        const el = document.querySelector(selector); const style = getComputedStyle(el); let parent = el, background;
        while (parent) { const bg = getComputedStyle(parent).backgroundColor; if (bg !== 'rgba(0, 0, 0, 0)') { background = bg; break; } parent = parent.parentElement; }
        const a = luminance(style.color), b = luminance(background);
        return { selector, ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05) };
      });
      return { contrast, headerBottom: document.querySelector('.site-header').getBoundingClientRect().bottom, infoTop: document.querySelector('.detail-info').getBoundingClientRect().top };
    });
    evidence.contrast.forEach(item => assert(item.ratio >= 4.5, `${item.selector} contrast ${item.ratio}`));
    assert(evidence.infoTop >= evidence.headerBottom); return evidence;
  });
  await check('AC5 quantity / total / cart / toast / save', async () => {
    assert(await page.getByRole('button', { name: 'Giảm số lượng' }).isDisabled());
    await page.getByRole('button', { name: 'Tăng số lượng' }).click();
    await page.getByRole('button', { name: 'Tăng số lượng' }).click();
    assert.equal((await page.locator('.qty-picker span').innerText()).trim(), '3');
    assert.equal((await page.locator('.detail-add-total').innerText()).replace(/\D/g, ''), String(product.price * 3));
    await page.locator('.detail-add').click(); assert(await page.locator('.toast').isVisible());
    const cart = await page.evaluate(() => JSON.parse(localStorage.getItem('inox-cart-v2')));
    assert.equal(cart.find(p => p.id === 19).qty, 3);
    await page.locator('.detail-save').click(); assert.equal(await page.locator('.detail-save').getAttribute('aria-pressed'), 'true');
    assert.match(await page.locator('.detail-save').innerText(), /Đã lưu sản phẩm/);
    await page.locator('.detail-save').click(); assert.equal(await page.locator('.detail-save').getAttribute('aria-pressed'), 'false');
    for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'Giảm số lượng' }).click();
    assert(await page.getByRole('button', { name: 'Giảm số lượng' }).isDisabled()); return cart;
  });
  await check('AC7 disclosure keyboard / copy / related', async () => {
    const details = page.locator('.product-disclosures details');
    for (let i = 0; i < await details.count(); i++) {
      const summary = details.nth(i).locator('summary'); await summary.focus(); await page.keyboard.press('Enter');
      assert(await details.nth(i).evaluate(el => el.open));
      await page.keyboard.press('Space'); assert(!(await details.nth(i).evaluate(el => el.open)));
      await summary.click(); assert(await details.nth(i).evaluate(el => el.open)); await summary.click();
    }
    const links = await page.locator('.related a[href^="/product/"]').evaluateAll(els => [...new Set(els.map(e => e.getAttribute('href')))]);
    assert(links.length > 0 && links.length <= 4); assert(!links.includes('/product/19'));
    for (const link of links) assert.equal(products.find(p => p.id === Number(link.split('/').pop())).category, product.category);
    return links;
  });
  await check('AC4 no-gallery / one-photo / no discount', async () => {
    assert.equal(await page.locator('.gallery-views').count(), 0);
    await visit(page, 18); assert.equal(await page.locator('.gallery-views').count(), 0); assert(await imgOK(page));
    assert.equal(await page.locator('.d-discount,.d-price-row .p-old,.d-price-row .p-off').count(), 0);
  });
  for (const width of [390, 320, 768]) {
    await check(`AC8 responsive ${width}px / touch / keyboard focus`, async () => {
      await page.setViewportSize({ width, height: 844 }); await visit(page, 19);
      const l = await layout(page); assert(l.scrollWidth <= width); assert(l.info.y > l.media.y); assert.equal(l.sticky, 'static');
      assert(l.qty.width >= 44 && l.qty.height >= 44 && l.add.height >= 44);
      await page.getByRole('button', { name: 'Tăng số lượng' }).focus(); await page.keyboard.press('Tab');
      const focus = await page.evaluate(() => ({ class: document.activeElement.className, outline: getComputedStyle(document.activeElement).outlineStyle, width: getComputedStyle(document.activeElement).outlineWidth }));
      assert(focus.class.includes('detail-add')); assert.notEqual(focus.outline, 'none'); assert.notEqual(focus.width, '0px');
      await page.locator('.detail-add').click(); assert(await page.locator('.toast').isVisible());
      if (width === 390) await shoot(page, 'product-detail-mobile.png'); return { ...l, focus };
    });
  }
  await check('AC8 reduced motion', async () => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const style = await page.locator('.detail-add').evaluate(el => ({ transition: getComputedStyle(el).transitionDuration, animation: getComputedStyle(el).animationName }));
    assert(Number.parseFloat(style.transition) <= 0.00001); assert.equal(style.animation, 'none'); return style;
  });
  await check('AC9 not-found returns catalog', async () => {
    await visit(page, 999999); assert.equal(await page.locator('main h1').innerText(), 'Sản phẩm không tồn tại');
    assert.equal(await page.getByRole('link', { name: 'Về trang sản phẩm' }).getAttribute('href'), '/san-pham');
    assert.equal(await page.locator('.detail-grid').count(), 0);
  });
  await check('No baseline console/page errors', async () => { assert.deepEqual(problems, []); });
  const galleryContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const p = await galleryContext.newPage(); const galleryProblems = [];
  watch(p, galleryProblems);
  const first = '/images/catalog/noi-chao.jpg', second = '/images/catalog/bat-dia.jpg';
  const galleryProducts = products.map(v => [19, 20].includes(v.id) ? { ...v, image: first, images: [first, second, first] } : v);
  await p.route('**/api/products', route => route.fulfill({ json: galleryProducts }));
  await visit(p, 19);
  await check('AC3 gallery click / keyboard / focus / deduplication', async () => {
    assert.equal(await p.locator('.gallery-views button').count(), 2);
    await p.locator('.gallery-views button').nth(1).click(); assert.equal(await p.locator('.detail-media img').getAttribute('src'), second);
    assert.equal(await p.locator('.gallery-views button').nth(1).getAttribute('aria-pressed'), 'true');
    await p.locator('.gallery-views button').first().focus(); await p.keyboard.press('Enter');
    assert.equal(await p.locator('.detail-media img').getAttribute('src'), first);
    const focus = await p.locator('.gallery-views button').first().evaluate(el => ({ visible: el.matches(':focus-visible'), outline: getComputedStyle(el).outlineStyle }));
    assert(focus.visible); assert.notEqual(focus.outline, 'none'); assert.deepEqual(galleryProblems, []); return focus;
  });
  await check('AC6 SPA product id resets quantity and selected image', async () => {
    await p.locator('.gallery-views button').nth(1).click(); await p.getByRole('button', { name: 'Tăng số lượng' }).click();
    await p.locator('.related a[href="/product/20"]').first().click(); await p.waitForURL('**/product/20');
    assert.equal((await p.locator('.qty-picker span').innerText()).trim(), '1');
    assert.equal(await p.locator('.detail-media img').getAttribute('src'), first);
    assert.equal(await p.locator('.gallery-views button').first().getAttribute('aria-pressed'), 'true');
  });
  await check('AC4 failed image fallback / still buyable', async () => {
    const broken = await galleryContext.newPage();
    await broken.route('**/api/products', route => route.fulfill({ json: products.map(v => v.id === 19 ? { ...v, image: '/images/qa-invalid.jpg', images: ['/images/qa-invalid.jpg'] } : v) }));
    await broken.route('**/images/qa-invalid.jpg', route => route.fulfill({ status: 200, contentType: 'image/jpeg', body: 'invalid jpeg' }));
    await visit(broken, 19); assert(await imgOK(broken)); assert.equal(await broken.locator('.gallery-views').count(), 0);
    assert.equal(await broken.locator('.detail-media img').getAttribute('src'), '/images/catalog/luu-tru.jpg');
    await broken.locator('.detail-add').click(); assert(await broken.locator('.toast').isVisible()); await broken.close();
  });
  await check('AC7 no related data / invalid old price hidden', async () => {
    const single = await context.newPage();
    await single.route('**/api/products', route => route.fulfill({ json: [{ ...product, oldPrice: product.price - 1 }] }));
    await visit(single, 19); assert.equal(await single.locator('.related').count(), 0);
    assert.equal(await single.locator('.d-discount,.d-price-row .p-old,.d-price-row .p-off').count(), 0); await single.close();
  });
  await check('AC9 loading / recoverable error / reload', async () => {
    const states = await context.newPage(); let fail = true;
    await states.route('**/api/products', async route => {
      await new Promise(r => setTimeout(r, 600));
      await route.fulfill(fail ? { status: 503, json: { error: 'Không tải được dữ liệu sản phẩm.' } } : { json: products });
    });
    await states.goto(`${BASE}/product/19`, { waitUntil: 'domcontentloaded' });
    await states.locator('main[aria-busy="true"]').waitFor(); assert.equal(await states.locator('.detail-grid').count(), 0);
    await states.getByRole('heading', { name: 'Không tải được sản phẩm' }).waitFor();
    fail = false; await states.getByRole('button', { name: 'Thử lại' }).click();
    await states.locator('#product-title').waitFor(); assert.equal(await states.locator('#product-title').innerText(), product.name); await states.close();
  });
  fs.writeFileSync(path.join(OUT, 'product-detail-checks.json'), JSON.stringify({ base: BASE, results, problems, environment }, null, 2));
  await browser.close(); console.log(`PRODUCT DETAIL: ${results.filter(r => r.pass).length}/${results.length} PASS`);
  process.exitCode = results.some(r => !r.pass) ? 1 : 0;
})().catch(error => { console.error(error); process.exitCode = 2; });
