/**
 * Verify nhanh các tối ưu backend đang chạy trên server (mặc định :3000).
 * Dùng node:http để đo đúng số byte truyền trên dây (fetch của Node tự giải nén).
 * Chạy:  npm run check:perf (trong tools/) — hoặc: node scripts/verify-perf.mjs [port]
 */
const http = (await import('node:http')).default;

const base = `http://localhost:${process.argv[2] || 3000}`;
const fmt = (n) => `${(n / 1024).toFixed(1)} KB`;

const rawGet = (pathUrl, headers = {}) => new Promise((resolve, reject) => {
  const req = http.get(`${base}${pathUrl}`, { headers }, (res) => {
    const chunks = [];
    res.on('data', (c) => chunks.push(c));
    res.on('end', () => resolve({
      status: res.statusCode,
      bytes: Buffer.concat(chunks).length,
      text: () => Buffer.concat(chunks).toString('utf8'),
      headers: res.headers,
    }));
  });
  req.on('error', reject);
});

const main = async () => {
  // 0) Health
  const health = JSON.parse((await rawGet('/api/health')).text());
  console.log(`[health] ${health.name} v${health.version} · uptime ${health.uptime}s`);

  // 1) Tài nguyên tĩnh: byte trên dây theo từng kiểu nén
  const html = (await rawGet('/')).text();
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g)].map((m) => m[1]);
  for (const asset of assets) {
    const plain = await rawGet(asset, { 'Accept-Encoding': 'identity' });
    const gz = await rawGet(asset, { 'Accept-Encoding': 'gzip' });
    const br = await rawGet(asset, { 'Accept-Encoding': 'br' });
    const save = (small) => `${Math.round((1 - small / plain.bytes) * 100)}%`;
    console.log(`[${asset.split('/').pop()}] gốc ${fmt(plain.bytes)} → gzip ${fmt(gz.bytes)} (${save(gz.bytes)}) → brotli ${fmt(br.bytes)} (${save(br.bytes)}) · encoding=${br.headers['content-encoding']} · cache=${br.headers['cache-control']}`);
  }

  // 2) API: gzip + ETag / 304
  const first = await rawGet('/api/products', { 'Accept-Encoding': 'gzip' });
  const etag = first.headers.etag;
  const revalidate = await rawGet('/api/products', { 'Accept-Encoding': 'gzip', 'If-None-Match': etag });
  console.log(`[API /api/products] dây ${fmt(first.bytes)} (gzip) · ETag ${etag} · revalidate → HTTP ${revalidate.status} · body ${revalidate.status === 304 ? '0 B (không tải lại — OK)' : fmt(revalidate.bytes)}`);

  // 3) Chi tiết sản phẩm: cache header
  const detail = await rawGet('/api/products/1');
  console.log(`[API chi tiết] cache-control=${detail.headers['cache-control']}`);
};

main().catch((err) => {
  console.error('Lỗi verify:', err.message);
  process.exit(1);
});


