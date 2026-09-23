'use strict';

/* Sinh seed insert-only, idempotent. Script không đụng Orders/OrderItems và không overwrite
 * dữ liệu chủ shop đã sửa trong SSMS. Chạy generator rồi review seed-catalog-safe.sql trước F5. */
const fs = require('node:fs');
const path = require('node:path');

const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'products.json'), 'utf8'));
const outFile = path.join(__dirname, 'seed-catalog-safe.sql');
const q = (value) => value == null ? 'NULL' : `N'${String(value).replace(/'/g, "''")}'`;
const n = (value) => value == null ? 'NULL' : String(Number(value));
const lines = [
  '/* INSERT-ONLY / IDEMPOTENT. Backup DB và review trước khi chạy trong SSMS. */',
  'USE [DoCuQuangHuy];', 'GO', 'SET XACT_ABORT ON;', 'BEGIN TRANSACTION;',
  "IF NOT EXISTS (SELECT 1 FROM dbo.PromoCodes WHERE Code=N'QUANGHUY10')",
  "  INSERT dbo.PromoCodes(Code,DiscountRate,IsActive,[Description]) VALUES(N'QUANGHUY10',0.100,1,N'Giảm 10% toàn đơn');",
];

for (const category of catalog.categories || []) {
  lines.push(`IF NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE CategoryKey=${q(category.key)})`);
  lines.push(`  INSERT dbo.Categories(CategoryKey,Label,ImageUrl) VALUES(${q(category.key)},${q(category.label)},${q(category.image)});`);
}
for (const product of catalog.products || []) {
  lines.push(`IF NOT EXISTS (SELECT 1 FROM dbo.Products WHERE ProductId=${n(product.id)})`);
  lines.push(`  INSERT dbo.Products(ProductId,Name,CategoryKey,Price,OldPrice,Rating,Sold,Badge,[Description],ImageUrl) VALUES(${n(product.id)},${q(product.name)},${q(product.category)},${n(product.price)},${n(product.oldPrice)},${n(product.rating)},${n(product.sold)},${q(product.badge)},${q(product.description)},${q(product.image)});`);
  (product.specs || []).forEach((spec, index) => {
    lines.push(`IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=${n(product.id)} AND SortOrder=${index + 1}) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(${n(product.id)},${index + 1},${q(spec)});`);
  });
  (product.images || []).forEach((url, index) => {
    lines.push(`IF NOT EXISTS (SELECT 1 FROM dbo.ProductImages WHERE ProductId=${n(product.id)} AND SortOrder=${index + 1}) INSERT dbo.ProductImages(ProductId,SortOrder,Url) VALUES(${n(product.id)},${index + 1},${q(url)});`);
  });
}
lines.push('SELECT @@ROWCOUNT AS LastStatementRows;', 'COMMIT TRANSACTION;', 'GO', '');
fs.writeFileSync(outFile, `\ufeff${lines.join('\r\n')}`, 'utf8');
console.log(`Đã sinh seed an toàn: ${outFile}`);
