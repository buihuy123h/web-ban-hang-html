'use strict';

/* Integration assertion cho SQL Server CI tạm.
 * Không in request body, dữ liệu khách hàng, credential hoặc lỗi driver thô. */
const path = require('node:path');
const sql = require(path.resolve(__dirname, '..', '..', 'server', 'node_modules', 'mssql'));

const required = (name) => {
  const value = String(process.env[name] || '');
  if (!value) throw new Error(`Thiếu biến môi trường ${name}.`);
  return value;
};

const requestJson = async (url, options = {}) => {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(15_000) });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`HTTP_${response.status}`);
  return body;
};

const mustBeDenied = async (label, action) => {
  try {
    await action();
  } catch {
    console.log(`[sql-ci] PASS quyền runtime từ chối ${label}.`);
    return;
  }
  throw new Error(`RUNTIME_PERMISSION_TOO_BROAD_${label.toUpperCase().replace(/\W+/g, '_')}`);
};

const run = async () => {
  if (!/^(true|1)$/i.test(String(process.env.CI || ''))) throw new Error('verify-sql-ci chỉ chạy khi CI=true.');
  const base = String(process.env.BASE || 'http://127.0.0.1:3000').replace(/\/+$/, '');
  const health = await requestJson(`${base}/api/health`);
  if (!health.ok || health.database !== 'connected') throw new Error('HEALTH_NOT_READY');
  const products = await requestJson(`${base}/api/products`);
  if (!Array.isArray(products) || products.length === 0) throw new Error('CATALOG_EMPTY');

  const orderResponse = await requestJson(`${base}/api/orders`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      items: [{ id: products[0].id, qty: 1 }], delivery: 'standard', payment: 'cod',
      customer: { name: 'Khach CI', phone: '0900000000', address: 'Dia chi test runner CI' },
    }),
  });
  const orderCode = orderResponse && orderResponse.order && orderResponse.order.code;
  if (!/^DI\d{8}$/.test(String(orderCode || ''))) throw new Error('ORDER_CONTRACT_INVALID');

  const pool = await new sql.ConnectionPool({
    server: required('DB_SERVER'), port: Number(process.env.DB_PORT || 1433),
    database: required('DB_NAME'), user: required('DB_USER'), password: required('DB_PASSWORD'),
    connectionTimeout: 15_000, requestTimeout: 15_000,
    options: { encrypt: true, trustServerCertificate: true, enableArithAbort: true },
  }).connect();
  try {
    const permissions = await pool.request().query(`
      SELECT
        HAS_PERMS_BY_NAME('dbo.usp_TaoDonHang', 'OBJECT', 'EXECUTE') AS CanCreateOrder,
        HAS_PERMS_BY_NAME('dbo.Orders', 'OBJECT', 'INSERT') AS CanInsertOrder,
        HAS_PERMS_BY_NAME('dbo.Orders', 'OBJECT', 'ALTER') AS CanAlterOrder;
    `);
    const row = permissions.recordset[0];
    if (row.CanCreateOrder !== 1 || row.CanInsertOrder !== 0 || row.CanAlterOrder !== 0) {
      throw new Error('RUNTIME_PERMISSION_MATRIX_INVALID');
    }
    await mustBeDenied('direct table write', () => pool.request().query(`
      INSERT dbo.Orders (OrderCode, DeliveryMethod, PaymentMethod, Subtotal, ShippingFee, Discount,
        CustomerName, CustomerPhone, CustomerAddress, CreatedAt)
      VALUES ('DI00000000', 'standard', 'cod', 0, 0, 0, 'CI', '0900000000', 'CI denied', SYSUTCDATETIME());
    `));
    await mustBeDenied('DDL', () => pool.request().query('ALTER TABLE dbo.Orders ADD CiMustNotExist bit NULL;'));
  } finally {
    await pool.close().catch(() => {});
  }
  console.log('[sql-ci] PASS health, catalog, order commit contract và least privilege.');
};

run().catch((error) => {
  const code = /^[A-Z0-9_]+$/.test(String(error && error.message)) ? error.message : (error.code || error.name || 'VERIFY_FAILED');
  console.error(`[sql-ci] FAIL code=${code}`);
  process.exitCode = 1;
});
