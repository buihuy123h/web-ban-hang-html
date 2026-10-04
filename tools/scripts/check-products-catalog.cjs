/* QA catalogue: backend fixture và intercept trong browser; không sửa dữ liệu runtime. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const BASE = process.env.BASE || 'http://localhost:3100';
const OUT = path.join(__dirname, '..', 'artifacts');
const results = [], problems = [], environment = [];
const check = async (name, fn) => {
  try { const evidence = await fn(); results.push({ name, pass: true, evidence }); console.log('PASS', name, evidence || ''); }
  catch (e) { results.push({ name, pass: false, error: e.message }); console.log('FAIL', name, e.message); }
};
const visit = async (page, search = '') => {
  await page.goto(`${BASE}/san-pham${search}`, { waitUntil: 'networkidle' });
  await page.locator('.catalogue-section-bar').waitFor();
};
const ids = page => page.locator('.p-media-link').evaluateAll(els => els.map(e => Number(e.getAttribute('href').split('/').pop())));
const params = page => Object.fromEntries(new URL(page.url()).searchParams);
const sortControl = page => page.locator('.catalogue-sort select:visible');
const assertGrid = async (page, count) => assert.equal(await page.locator('.p-card').count(), count);
const shoot = async (page, name) => {
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo({ top: y, behavior: 'instant' }); await new Promise(r => setTimeout(r, 150)); } scrollTo({ top: 0, behavior: 'instant' }); });
  await page.waitForTimeout(750); await page.screenshot({ path: path.join(OUT, name), fullPage: true });
};
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const products = await fetch(`${BASE}/api/products`).then(r => r.json());
  const categories = [{ key: 'all', label: 'Tất cả' }, ...await fetch(`${BASE}/api/categories`).then(r => r.json())];
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'vi-VN' });
  const page = await context.newPage();
  page.on('pageerror', e => problems.push(e.message));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    if (m.location().url.startsWith('https://fonts.googleapis.com/') && m.text().includes('ERR_NETWORK_ACCESS_DENIED')) { environment.push(m.location().url); return; }
    problems.push({ text: m.text(), location: m.location() });
  });
  await visit(page);
  await check('AC1/4/5 desktop hierarchy / 4 columns / one sort / contrast', async () => {
    assert.equal(await page.locator('main h1').innerText(), 'Sản phẩm');
    assert.equal(await page.locator('.breadcrumbs [aria-current="page"]').innerText(), 'Sản phẩm');
    assert.equal(await page.locator('.catalogue-trust li').count(), 3);
    assert(await page.locator('.catalogue-sidebar').isVisible()); assert.equal(await sortControl(page).count(), 1);
    const e = await page.evaluate(() => {
      const rect = s => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
      const bar = document.querySelector('.catalogue-section-bar'), c = getComputedStyle(bar);
      const lum = col => col.match(/[\d.]+/g).slice(0,3).map(Number).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((s,v,i) => s + v * [.2126,.7152,.0722][i],0);
      const a = lum(c.color), b = lum(c.backgroundColor);
      return { banner: rect('.catalogue-banner'), trust: rect('.catalogue-trust'), sidebar: rect('.catalogue-sidebar'), content: rect('.catalogue-content'), grid: rect('.catalogue .product-grid'), columns: getComputedStyle(document.querySelector('.catalogue .product-grid')).gridTemplateColumns.split(' ').length, contrast: (Math.max(a,b)+.05)/(Math.min(a,b)+.05) };
    });
    assert.equal(e.columns, 4); assert(e.sidebar.x < e.content.x); assert(e.banner.y < e.trust.y && e.trust.y < e.content.y); assert(e.contrast >= 4.5);
    assert(!/thegioitramhuong|Thế Giới Trầm Hương/i.test(await page.locator('main').innerText()));
    assert.equal(await page.locator('.catalogue-banner img').getAttribute('src'), '/images/catalog/noi-chao.jpg');
    await assertGrid(page, products.length); await shoot(page, 'products-catalog-desktop.png'); return e;
  });
  await check('AC2 categories / counts / active / preserve q and sort', async () => {
    assert.equal(await page.locator('.catalogue-categories button').count(), categories.length);
    for (let i = 0; i < categories.length; i++) {
      const btn = page.locator('.catalogue-categories button').nth(i);
      assert.equal(await btn.locator('span').first().innerText(), categories[i].label);
      assert.equal(Number(await btn.locator('.catalogue-category-count').innerText()), categories[i].key === 'all' ? products.length : products.filter(p => p.category === categories[i].key).length);
    }
    await page.getByRole('searchbox', { name: 'Tìm sản phẩm' }).fill('inox');
    await sortControl(page).selectOption('price-asc');
    const index = categories.findIndex(c => c.key === 'luu-tru');
    await page.locator('.catalogue-categories button').nth(index).click();
    assert.deepEqual(params(page), { q: 'inox', sort: 'price-asc', cat: 'luu-tru' });
    assert.equal(await page.locator('.catalogue-categories button').nth(index).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.getByRole('combobox', { name: 'Chọn danh mục' }).inputValue(), 'luu-tru');
    assert.equal(await page.locator('.catalogue-section-bar h2').innerText(), categories[index].label);
    await assertGrid(page, products.filter(p => p.category === 'luu-tru' && /inox/i.test(p.name)).length);
  });
  await check('AC3 sorting all modes / reload / default params omitted', async () => {
    await visit(page, '?q=inox&cat=luu-tru&sort=price-desc');
    const priceDesc = (await ids(page)).map(id => products.find(p => p.id === id).price);
    assert(priceDesc.every((p,i,a) => i === 0 || a[i-1] >= p));
    await page.reload({ waitUntil: 'networkidle' }); assert.equal(await sortControl(page).inputValue(), 'price-desc');
    assert.equal(await page.getByRole('searchbox', { name: 'Tìm sản phẩm' }).inputValue(), 'inox');
    assert.deepEqual((await ids(page)).map(id => products.find(p => p.id === id).price), priceDesc);
    await sortControl(page).selectOption('price-asc'); const asc = (await ids(page)).map(id => products.find(p => p.id === id).price); assert(asc.every((v,i,a) => i===0 || a[i-1]<=v));
    await sortControl(page).selectOption('rating'); const rating = (await ids(page)).map(id => products.find(p => p.id === id).rating); assert(rating.every((v,i,a) => i===0 || a[i-1]>=v));
    await sortControl(page).selectOption('popular'); assert(!('sort' in params(page)));
    await page.getByRole('combobox', { name: 'Chọn danh mục' }).selectOption('all'); assert(!('cat' in params(page)));
    await page.getByRole('searchbox', { name: 'Tìm sản phẩm' }).fill(''); assert.deepEqual(params(page), {});
    const sold = (await ids(page)).map(id => products.find(p => p.id === id).sold); assert(sold.every((v,i,a) => i===0 || a[i-1]>=v)); return { priceDesc, asc, rating };
  });
  await check('AC3 quick search toggle preserves category/sort', async () => {
    await visit(page, '?cat=ban-ghe&sort=rating'); const quick = page.locator('.catalogue-quick button').filter({ hasText: 'Ghế nhựa' });
    await quick.click(); assert.deepEqual(params(page), { cat:'ban-ghe', sort:'rating', q:'Ghế nhựa' }); assert.equal(await quick.getAttribute('aria-pressed'), 'true');
    await quick.click(); assert.deepEqual(params(page), { cat:'ban-ghe', sort:'rating' }); assert.equal(await quick.getAttribute('aria-pressed'), 'false');
  });
  await check('AC7 unknown category / whitespace / no match / clear', async () => {
    for (const search of ['?cat=unknown&sort=rating', '?q=%20%20&cat=ban-ghe&sort=price-asc', '?q=zzzzzz']) {
      await visit(page, search); await assertGrid(page, 0); assert(await page.getByRole('heading', { name:'Chưa có sản phẩm nào khớp' }).isVisible());
      if (search.includes('unknown')) assert.equal(await page.locator('.catalogue-section-bar h2').innerText(), 'Danh mục không tồn tại');
      await page.getByRole('button', { name:'Xóa lọc', exact:true }).click(); assert.deepEqual(params(page), {}); await assertGrid(page, products.length);
    }
    await visit(page,'?q=zzzz'); await page.getByRole('button', { name:'Xem tất cả sản phẩm' }).click(); assert.deepEqual(params(page), {}); await assertGrid(page, products.length);
  });
  await check('AC5 card detail / add / save unchanged', async () => {
    const card = page.locator('.p-card').first(); const id = (await ids(page))[0];
    assert(await card.locator('.p-price').isVisible()); assert(await card.locator('.p-score').isVisible());
    await card.locator('.p-add').click(); assert(await page.locator('.toast').isVisible());
    assert.equal(await page.evaluate(id => JSON.parse(localStorage.getItem('inox-cart-v2')).find(p => p.id === id).qty,id),1);
    await card.locator('.p-save').click(); assert.equal(await card.locator('.p-save').getAttribute('aria-pressed'),'true');
    await card.locator('.p-save').click(); assert.equal(await card.locator('.p-save').getAttribute('aria-pressed'),'false');
    await card.locator('.p-media-link').click(); await page.waitForURL(`**/product/${id}`); assert.equal(await page.locator('#product-title').innerText(), products.find(p=>p.id===id).name); await visit(page);
  });
  for (const width of [768,390,320]) await check(`AC6 layout ${width}px / accessible sort/search / card bounds`, async () => {
    await page.setViewportSize({ width, height:844 }); await visit(page);
    assert.equal(await sortControl(page).count(),1); assert(!(await page.locator('.catalogue-sidebar').isVisible()));
    const l = await page.evaluate(() => {
      const box = e => { const r=e.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}; };
      const card=document.querySelector('.p-card');
      return { width:innerWidth, scrollWidth:document.documentElement.scrollWidth, columns:getComputedStyle(document.querySelector('.product-grid')).gridTemplateColumns.split(' ').length, search:box(document.querySelector('.catalogue-query')), sort:box([...document.querySelectorAll('.catalogue-sort select')].find(e=>e.getBoundingClientRect().width)), card:box(card), add:box(card.querySelector('.p-add')), save:box(card.querySelector('.p-save')), quickHeights:[...document.querySelectorAll('.catalogue-quick button')].map(e=>e.getBoundingClientRect().height), titleClamp:getComputedStyle(card.querySelector('.p-name a')).webkitLineClamp, overflow:[...document.querySelectorAll('.p-card')].filter(e=>e.scrollWidth>e.clientWidth+1).length };
    });
    assert(l.scrollWidth<=width); assert.equal(l.columns,width===768?3:2); assert.equal(l.overflow,0); assert(l.add.height>=44&&l.save.width>=44&&l.save.height>=44);
    assert(l.add.right<=l.card.right+1); assert(l.sort.height>=44); assert(l.search.height>=44); assert.equal(l.titleClamp,'2');
    if(width<=640) assert(l.quickHeights.every(h=>h>=44),'Quick search chips need 44px touch targets');
    await page.getByRole('combobox',{name:'Chọn danh mục'}).selectOption('luu-tru'); await assertGrid(page,products.filter(p=>p.category==='luu-tru').length);
    await sortControl(page).selectOption('price-desc'); assert.equal(params(page).sort,'price-desc');
    await page.locator('.p-add').first().click(); assert(await page.locator('.toast').isVisible());
    if(width===390) { await visit(page); await shoot(page,'products-catalog-mobile.png'); } return l;
  });
  await check('AC8 keyboard controls / focus / reduced motion',async()=>{
    await page.setViewportSize({width:1440,height:1000}); await visit(page);
    const first=page.locator('.catalogue-categories button').nth(1); await first.focus(); await page.keyboard.press('Enter'); assert.equal(await first.getAttribute('aria-pressed'),'true');
    await page.getByRole('searchbox',{name:'Tìm sản phẩm'}).focus();
    assert.equal(await page.locator('.catalogue-query').evaluate(e=>getComputedStyle(e).outlineWidth),'2px');
    await page.keyboard.press('Tab'); assert.equal(await page.evaluate(()=>document.activeElement.closest('label').className),'catalogue-category-select');
    await page.keyboard.press('Tab'); assert.equal(await page.evaluate(()=>document.activeElement.className),'catalogue-search-submit');
    assert.equal(await page.locator('.catalogue-search-submit').evaluate(e=>getComputedStyle(e).outlineWidth),'2px');
    await page.emulateMedia({reducedMotion:'reduce'}); const motion=await page.locator('.p-card').first().evaluate(e=>({animation:getComputedStyle(e).animationName,transition:getComputedStyle(e.querySelector('.p-add')).transitionDuration}));
    assert.equal(motion.animation,'none'); assert(parseFloat(motion.transition)<=.00001); return motion;
  });
  await check('AC2 dynamic API category and zero counts',async()=>{
    const p=await context.newPage(); await p.route('**/api/categories',r=>r.fulfill({json:[...categories.slice(1),{key:'qa-extra',label:'Danh mục QA động'}]}));
    await visit(p); const btn=p.locator('.catalogue-categories button').filter({hasText:'Danh mục QA động'}); assert.equal(await btn.locator('.catalogue-category-count').innerText(),'0');
    await btn.click(); assert.equal(params(p).cat,'qa-extra'); await assertGrid(p,0); assert.equal(await p.locator('.catalogue-section-bar h2').innerText(),'Danh mục QA động'); await p.close();
  });
  await check('AC7 loading/error/retry preserves URL; empty catalog',async()=>{
    const p=await context.newPage(); let fail=true;
    await p.route('**/api/products',async r=>{await new Promise(resolve=>setTimeout(resolve,700));await r.fulfill(fail?{status:503,json:{error:'Không tải được dữ liệu sản phẩm.'}}:{json:products});});
    await p.goto(`${BASE}/san-pham?cat=luu-tru&sort=rating`,{waitUntil:'domcontentloaded'});await p.locator('.catalogue-loading[aria-busy="true"]').waitFor();assert.equal(await p.locator('.p-card').count(),0);
    await p.getByRole('heading',{name:'Không tải được sản phẩm'}).waitFor(); assert.equal(await p.locator('.catalogue-trust').count(),0);fail=false;
    await p.getByRole('button',{name:'Thử lại'}).click();await p.locator('.catalogue-section-bar').waitFor();assert.deepEqual(params(p),{cat:'luu-tru',sort:'rating'});await assertGrid(p,3);await p.close();
    const empty=await context.newPage();await empty.route('**/api/products',r=>r.fulfill({json:[]}));await visit(empty);assert.match(await empty.locator('.catalogue-result').first().innerText(),/0 \/ 0 sản phẩm/);await assertGrid(empty,0);await empty.close();
  });
  await check('No baseline app console/page errors',async()=>assert.deepEqual(problems,[]));
  fs.writeFileSync(path.join(OUT,'products-catalog-checks.json'),JSON.stringify({base:BASE,results,problems,environment},null,2));
  await browser.close();console.log(`CATALOG: ${results.filter(r=>r.pass).length}/${results.length} PASS`);process.exitCode=results.some(r=>!r.pass)?1:0;
})().catch(e=>{console.error(e);process.exitCode=2;});
