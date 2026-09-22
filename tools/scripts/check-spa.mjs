/* Kiểm tra SPA fallback cho deep-link trang lazy + header cache của chunk lazy. */
const base = 'http://localhost:3000';
for (const p of ['/about', '/cart', '/san-pham?cat=luu-tru']) {
  const r = await fetch(base + p);
  const t = await r.text();
  console.log(p, r.status, r.headers.get('content-type').split(';')[0], 'root-div=' + t.includes('<div id="root">'));
}
const ls = await (await fetch(base + '/san-pham')).text();
const m = ls.match(/assets\/Products-[A-Za-z0-9_-]+\.js/g);
console.log('lazy chunk ref:', m && m[0]);
if (m) {
  const c = await fetch(base + '/' + m[0]);
  console.log('chunk:', c.status, 'content-encoding=' + c.headers.get('content-encoding'), 'cache-control=' + (c.headers.get('cache-control') || '').slice(0, 45));
}
