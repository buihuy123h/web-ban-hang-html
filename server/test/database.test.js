'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createConfig, createDatabase } = require('../lib/db');
const { createCatalogRepository, mapProduct } = require('../models/catalog.model');
const { createOrderRepository } = require('../models/order.model');

const withEnv = (overrides, action) => {
  const previous = new Map();
  for (const [name, value] of Object.entries(overrides)) {
    previous.set(name, process.env[name]);
    if (value == null) delete process.env[name];
    else process.env[name] = String(value);
  }
  try { return action(); } finally {
    for (const [name, value] of previous) {
      if (value == null) delete process.env[name];
      else process.env[name] = value;
    }
  }
};

test('DB config dùng Windows Authentication và timeout hữu hạn', () => {
  /* withEnv cô lập test khỏi môi trường chạy: GitHub Actions tự set CI=true trên
   * mọi runner — test cũ đọc lọt biến này nên đỏ trên CI dù xanh ở local.
   * Ép về ngữ cảnh máy dev: không CI, không production, không credential SQL sót lại. */
  withEnv({
    DB_AUTH_MODE: 'windows', DB_SERVER: '.\\SQLEXPRESS', DB_NAME: 'DoCuQuangHuy',
    DB_DRIVER: 'msnodesqlv8', DB_TRUSTED_CONNECTION: 'true',
    DB_USER: null, DB_PASSWORD: null, DB_PORT: null, DB_ODBC_DRIVER: null,
    DB_TRUST_SERVER_CERTIFICATE: null, DB_ALLOW_SELF_SIGNED_CI: null,
    CI: 'false', NODE_ENV: 'development',
  }, () => {
    const config = createConfig();
    assert.equal(config.server, '.');
    assert.equal(config.options.instanceName, 'SQLEXPRESS');
    assert.equal(config.database, 'DoCuQuangHuy');
    assert.equal(config.driver, 'ODBC Driver 18 for SQL Server');
    assert.equal(config.options.trustedConnection, true);
    assert.equal(config.requestTimeout, 15000);
    assert.ok(config.pool.max > 0);
  });
});

test('DB config SQL Authentication không nạp adapter Windows và giữ password trong driver config', () => {
  withEnv({
    DB_AUTH_MODE: 'sql', DB_SERVER: '127.0.0.1', DB_PORT: '1433', DB_NAME: 'DoCuQuangHuy',
    DB_USER: 'ci_runtime', DB_PASSWORD: 'S3cret!with;special=chars', DB_DRIVER: null,
    DB_TRUSTED_CONNECTION: null, DB_ENCRYPT: 'true', DB_TRUST_SERVER_CERTIFICATE: 'false',
    DB_ALLOW_SELF_SIGNED_CI: null, CI: 'false', NODE_ENV: 'development',
  }, () => {
    const config = createConfig();
    assert.equal(config.authMode, 'sql');
    assert.equal(config.user, 'ci_runtime');
    assert.equal(config.password, 'S3cret!with;special=chars');
    assert.equal(config.options.encrypt, true);
    assert.equal(config.options.trustServerCertificate, false);
    assert.equal(config.driver, undefined);
  });
});

test('DB config fail-fast cho mode, credential, pool và timeout sai mà không lộ password', () => {
  const secret = 'DoNotPrint-Password!';
  const cases = [
    [{ DB_AUTH_MODE: 'oracle' }, /DB_AUTH_MODE/],
    [{ DB_AUTH_MODE: 'sql', DB_USER: '', DB_PASSWORD: secret }, /DB_USER/],
    [{ DB_AUTH_MODE: 'sql', DB_USER: 'runtime', DB_PASSWORD: '' }, /DB_PASSWORD/],
    [{ DB_AUTH_MODE: 'sql', DB_USER: 'runtime', DB_PASSWORD: secret, DB_POOL_MIN: '11', DB_POOL_MAX: '10' }, /DB_POOL_MIN/],
    [{ DB_AUTH_MODE: 'sql', DB_USER: 'runtime', DB_PASSWORD: secret, DB_CONNECT_TIMEOUT_MS: 'abc' }, /DB_CONNECT_TIMEOUT_MS/],
    [{ DB_AUTH_MODE: 'windows', DB_USER: null, DB_PASSWORD: null, DB_TRUSTED_CONNECTION: 'false' }, /DB_TRUSTED_CONNECTION/],
  ];
  for (const [overrides, expected] of cases) {
    withEnv({
      DB_AUTH_MODE: null, DB_USER: null, DB_PASSWORD: null, DB_POOL_MIN: null, DB_POOL_MAX: null,
      DB_CONNECT_TIMEOUT_MS: null, DB_TRUSTED_CONNECTION: null, CI: 'false', NODE_ENV: 'development',
      ...overrides,
    }, () => {
      assert.throws(createConfig, (error) => expected.test(error.message) && !error.message.includes(secret));
    });
  }
});

test('TLS production bị khóa; ngoại lệ self-signed chỉ hợp lệ đúng bộ cờ CI SQL', () => {
  const common = {
    DB_AUTH_MODE: 'sql', DB_USER: 'runtime', DB_PASSWORD: 'not-logged', DB_ENCRYPT: 'true',
    DB_TRUSTED_CONNECTION: 'false', DB_ALLOW_SELF_SIGNED_CI: 'false',
  };
  withEnv({ ...common, NODE_ENV: 'production', CI: 'false', DB_ENCRYPT: 'false', DB_TRUST_SERVER_CERTIFICATE: 'false' }, () => {
    assert.throws(createConfig, /DB_ENCRYPT/);
  });
  withEnv({ ...common, NODE_ENV: 'production', CI: 'false', DB_TRUST_SERVER_CERTIFICATE: 'true' }, () => {
    assert.throws(createConfig, /DB_TRUST_SERVER_CERTIFICATE/);
  });
  withEnv({
    ...common, NODE_ENV: 'production', CI: 'true', DB_TRUST_SERVER_CERTIFICATE: 'true',
    DB_ALLOW_SELF_SIGNED_CI: 'true',
  }, () => {
    const config = createConfig();
    assert.equal(config.options.encrypt, true);
    assert.equal(config.options.trustServerCertificate, true);
  });
});

test('entrypoint fail-fast log tên biến cấu hình nhưng không lộ secret', () => {
  const secret = 'QA_SECRET_MUST_NOT_LEAK';
  const childEnv = {
    ...process.env, NODE_ENV: 'production', CI: 'false', DB_AUTH_MODE: 'invalid-mode',
    DB_USER: 'runtime', DB_PASSWORD: secret, DB_ENCRYPT: 'true', DB_TRUST_SERVER_CERTIFICATE: 'false',
  };
  delete childEnv.npm_lifecycle_event;
  const result = spawnSync(process.execPath, ['index.js'], {
    cwd: path.resolve(__dirname, '..'), encoding: 'utf8', timeout: 5000,
    env: childEnv,
  });
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  assert.equal(result.status, 1, output);
  assert.match(output, /DB_AUTH_MODE/);
  assert.doesNotMatch(output, new RegExp(secret));
  assert.doesNotMatch(output, /node_modules|\n\s+at\s/);
});

test('database chỉ ready sau connect + SELECT 1 và close hạ readiness', async () => {
  const calls = [];
  class Pool {
    constructor(config) { this.config = config; this.connected = false; }
    on() {}
    async connect() { calls.push('connect'); this.connected = true; }
    request() { return { query: async (sql) => { calls.push(sql); return {}; } }; }
    async close() { calls.push('close'); this.connected = false; }
  }
  const db = createDatabase({ sqlModule: { ConnectionPool: Pool }, config: {} });
  assert.equal(db.isReady(), false);
  await db.connect();
  assert.equal(db.isReady(), true);
  assert.deepEqual(calls.slice(0, 2), ['connect', 'SELECT 1 AS Ready']);
  await db.close();
  assert.equal(db.isReady(), false);
});

test('mapProduct đổi DECIMAL thành number và giữ thứ tự ảnh/spec từ SQL', () => {
  const product = mapProduct({
    ProductId: 7, Name: 'Kệ', CategoryKey: 'luu-tru', CategoryLabel: 'Lưu trữ',
    Price: '850000', OldPrice: '990000', Rating: '4.8', Sold: 2, Badge: 'new',
    Description: 'Mô tả', ImageUrl: null,
    ImagesJson: '[{"url":"/images/a.jpg"},{"url":"/images/b.jpg"}]',
    SpecsJson: '[{"text":"A"},{"text":"B"}]',
  });
  assert.equal(product.price, 850000);
  assert.equal(product.oldPrice, 990000);
  assert.equal(product.rating, 4.8);
  assert.deepEqual(product.images, ['/images/a.jpg', '/images/b.jpg']);
  assert.deepEqual(product.specs, ['A', 'B']);
});

test('catalog bind input, không nối giá trị tìm kiếm vào SQL', async () => {
  const inputs = [];
  let statement = '';
  const request = {
    input(name, type, value) { inputs.push({ name, type, value }); return this; },
    async query(sqlText) { statement = sqlText; return { recordset: [] }; },
  };
  const pool = { request: () => request };
  const sql = { NVarChar: (size) => `nvarchar(${size})`, Int: 'int' };
  const repo = createCatalogRepository({ pool, sql });
  await repo.listProducts({ cat: 'ban-ghe', q: "x' OR 1=1--", sort: 'unknown' });
  assert.equal(inputs[0].value, 'ban-ghe');
  assert.equal(inputs[1].value, "%x' OR 1=1--%");
  assert.doesNotMatch(statement, /OR 1=1/);
  assert.match(statement, /p\.Sold DESC, p\.ProductId ASC/);
});

test('order repository dùng TVP/procedure và map response đúng contract', async () => {
  class Table {
    constructor(name) {
      this.name = name;
      this.columns = { values: [], add: (...args) => this.columns.values.push(args) };
      this.rows = { values: [], add: (...args) => this.rows.values.push(args) };
    }
  }
  const values = new Map();
  const request = {
    input(name, type, value) { values.set(name, value === undefined ? type : value); return this; },
    async execute(name) {
      assert.equal(name, 'dbo.usp_TaoDonHang');
      return { recordsets: [[{
        OrderCode: 'DI12345678', DeliveryMethod: 'express', PaymentMethod: 'cod', PromoCode: null,
        Subtotal: '600000', ShippingFee: '45000', Discount: '0', Total: '645000',
        CustomerName: 'Nguyễn Test', CustomerPhone: '0901234567', CustomerAddress: '12 Nguyễn Huệ',
        Note: null, CreatedAt: new Date('2026-09-23T00:00:00Z'),
      }], [{ ProductId: 1, ProductName: 'Ghế', UnitPrice: '300000', Qty: 2 }]] };
    },
  };
  const sql = {
    Table, Int: 'int', NVarChar: (size) => `nvarchar(${size})`,
  };
  const repo = createOrderRepository({ pool: { request: () => request }, sql });
  const order = await repo.createOrder({
    items: [{ id: 1, qty: 2 }], delivery: 'express', payment: 'cod', promoCode: null,
    customer: { name: 'Nguyễn Test', phone: '0901234567', address: '12 Nguyễn Huệ', note: '' },
  });
  assert.equal(values.get('Items').name, 'dbo.OrderItemType');
  assert.deepEqual(values.get('Items').rows.values, [[1, 2]]);
  assert.equal(order.shippingFee, 45000);
  assert.equal(order.items[0].price, 300000);
  assert.equal(order.createdAt, '2026-09-23T00:00:00.000Z');
});
