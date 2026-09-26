'use strict';

/* TEST — tầng database PostgreSQL (Supabase):
 * 1) config fail-closed (DATABASE_URL duy nhất / sslmode / CA / pool / production TLS)
 * 2) createDatabase: pool pg + readiness (connect / close / lỗi pool)
 * 3) mapProduct giữ nguyên contract API
 * 4) catalog repository luôn bind input ($1, $2…)
 * 5) order repository gọi fn_tao_don_hang (items jsonb) + map response + P0001 → 400
 * 6) migration SQL không gọi construct parser (coalesce/nullif/…) có tiền tố schema
 * Không cần PostgreSQL thật: driver pg được tiêm giả lập, config qua env giả lập. */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const { createConfig, createDatabase } = require('../lib/db');
const { createCatalogRepository, mapProduct } = require('../models/catalog.model');
const { createOrderRepository } = require('../models/order.model');
const { validateCatalog, EXPECTED } = require('../database/postgres/seed');

const PG_ENV_KEYS = [
  'DATABASE_URL', 'MIGRATION_DATABASE_URL', 'PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSWORD',
  'PGSSL', 'PGSSL_REJECT_UNAUTHORIZED', 'PGSSL_CA', 'PGPOOL_MAX',
  'PGPOOL_IDLE_TIMEOUT_MS', 'PG_CONNECT_TIMEOUT_MS', 'PG_QUERY_TIMEOUT_MS',
];

/* Ép về ngữ cảnh sạch: xoá mọi biến PG/DATABASE_URL sót lại của máy dev/CI trước khi chạy case. */
const withEnv = (overrides, run) => {
  const backup = {};
  const keys = [...PG_ENV_KEYS, 'NODE_ENV', 'CI'];
  for (const key of keys) {
    backup[key] = process.env[key];
    if (!(key in overrides)) delete process.env[key];
  }
  try {
    for (const [key, value] of Object.entries(overrides)) {
      if (value === null) delete process.env[key];
      else process.env[key] = value;
    }
    return run();
  } finally {
    for (const [key, value] of Object.entries(backup)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
};

test('DB config chỉ đọc DATABASE_URL Supabase và bật TLS theo sslmode', () => {
  withEnv({
    DATABASE_URL: 'postgresql://app_runtime.abc123:S3cret@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require',
    NODE_ENV: 'development', CI: 'false',
  }, () => {
    const config = createConfig();
    assert.equal(config.host, 'aws-0-ap-southeast-1.pooler.supabase.com');
    assert.equal(config.port, 5432);
    assert.equal(config.database, 'postgres');
    assert.equal(config.user, 'app_runtime.abc123');
    assert.equal(config.password, 'S3cret');
    assert.deepEqual(config.ssl, { rejectUnauthorized: false });
    assert.equal(config.max, 10);
    assert.equal(config.application_name, 'do-cu-quang-huy');
  });
  withEnv({
    DATABASE_URL: 'postgres://runtime:pw@db.example.com/app?sslmode=require',
    NODE_ENV: 'development', CI: 'false',
  }, () => {
    const config = createConfig();
    assert.equal(config.port, 5432);
    assert.equal(config.database, 'app');
  });
});

test('DB config local dùng DATABASE_URL; biến PGHOST không phải nguồn credential thứ hai', () => {
  withEnv({
    DATABASE_URL: 'postgresql://postgres@localhost:5433/DoCuQuangHuy',
    PGHOST: 'db-khong-duoc-doc.example', PGPASSWORD: 'ignored',
    NODE_ENV: 'development', CI: 'false',
  }, () => {
    const config = createConfig();
    assert.equal(config.host, 'localhost');
    assert.equal(config.port, 5433);
    assert.equal(config.database, 'DoCuQuangHuy');
    assert.equal(config.user, 'postgres');
    assert.equal(config.ssl, undefined);
    assert.equal(config.idleTimeoutMillis, 30000);
    assert.equal(config.connectionTimeoutMillis, 10000);
    assert.equal(config.query_timeout, 15000);
  });
});

test('DB config fail-fast: sai URL/thiếu biến/host xa thiếu mật khẩu/pool sai — không lộ secret', () => {
  const secret = 'DoNotPrint-Password!';
  const cases = [
    [{ DATABASE_URL: 'mysql://user:secret@host/db' }, /DATABASE_URL/],
    [{ DATABASE_URL: 'postgres://' }, /DATABASE_URL/],
    [{}, /DATABASE_URL|PGHOST/],
    [{ DATABASE_URL: 'postgresql://u@db.example.com/app?sslmode=require' }, /DATABASE_URL/],
    [{ DATABASE_URL: `postgresql://u:${secret}@db.example.com:5432/app?sslmode=require`, PGPOOL_MAX: '0' }, /PGPOOL_MAX/],
    [{ DATABASE_URL: `postgresql://u:${secret}@db.example.com:5432/app?sslmode=maybe` }, /DATABASE_URL/],
    [{ DATABASE_URL: `postgresql://u:${secret}@db.example.com:5432/app?sslmode=require`, PG_CONNECT_TIMEOUT_MS: 'abc' }, /PG_CONNECT_TIMEOUT_MS/],
  ];
  for (const [overrides, expected] of cases) {
    withEnv({ NODE_ENV: 'development', CI: 'false', ...overrides }, () => {
      assert.throws(createConfig, (error) => expected.test(error.message) && !error.message.includes(secret));
    });
  }
});

test('Production bắt buộc SSL (Supabase yêu cầu TLS)', () => {
  withEnv({
    DATABASE_URL: 'postgresql://u:pw@db.example.com:5432/app?sslmode=disable',
    NODE_ENV: 'production', CI: 'false',
  }, () => {
    assert.throws(createConfig, /TLS|sslmode/);
  });
  withEnv({
    DATABASE_URL: 'postgresql://u:pw@db.example.com:5432/app?sslmode=require',
    NODE_ENV: 'production', CI: 'false',
  }, () => {
    assert.deepEqual(createConfig().ssl, { rejectUnauthorized: false });
  });
});

test('PGSSL_CA đọc file CA và ép xác thực certificate chặt', () => {
  const caFile = path.join(os.tmpdir(), `dqh-ca-${process.pid}.pem`);
  fs.writeFileSync(caFile, '-----BEGIN CERTIFICATE-----\nfake\n-----END CERTIFICATE-----\n');
  try {
    withEnv({
      DATABASE_URL: 'postgresql://u:pw@db.example.com:5432/app?sslmode=verify-full',
      PGSSL_CA: caFile, NODE_ENV: 'development', CI: 'false',
    }, () => {
      const config = createConfig();
      assert.ok(config.ssl.ca.includes('BEGIN CERTIFICATE'));
      assert.equal(config.ssl.rejectUnauthorized, true);
    });
    withEnv({
      DATABASE_URL: 'postgresql://u:pw@db.example.com:5432/app?sslmode=verify-full',
      PGSSL_CA: path.join(os.tmpdir(), 'dqh-ca-khong-ton-tai.pem'),
      NODE_ENV: 'development', CI: 'false',
    }, () => {
      assert.throws(createConfig, /PGSSL_CA/);
    });
  } finally {
    fs.rmSync(caFile, { force: true });
  }
});

test('entrypoint fail-fast: log tên biến cấu hình, không lộ secret, không in stack', () => {
  const secret = 'QA_SECRET_MUST_NOT_LEAK';
  const childEnv = {
    ...process.env, NODE_ENV: 'development', CI: 'false',
    DATABASE_URL: `postgresql://postgres:${secret}@db.example.com:5432/app?sslmode=maybe`,
  };
  delete childEnv.npm_lifecycle_event; // tắt IS_TEST để đi đúng nhánh runtime thật
  const result = spawnSync(process.execPath, ['index.js'], {
    cwd: path.resolve(__dirname, '..'), encoding: 'utf8', timeout: 10000, env: childEnv,
  });
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  assert.equal(result.status, 1, output);
  assert.match(output, /DATABASE_URL/);
  assert.doesNotMatch(output, new RegExp(secret));
  assert.doesNotMatch(output, /node_modules|\n\s+at\s/);
});

test('database chỉ ready sau connect + SELECT 1; lỗi pool hạ readiness; close đóng pool', async () => {
  const calls = [];
  class FakePool {
    constructor(config) { this.config = config; this.handlers = {}; }
    on(event, handler) { this.handlers[event] = handler; }
    async query(text) { calls.push(text); return { rows: [{ ready: 1 }] }; }
    async end() { calls.push('end'); }
  }
  const database = createDatabase({ pgModule: { Pool: FakePool }, config: { host: 'localhost' } });
  assert.equal(database.isReady(), false);
  await database.connect();
  assert.equal(database.isReady(), true);
  assert.deepEqual(calls, ['SELECT 1 AS ready']);
  database.pool.handlers.error(new Error('idle client lỗi'));
  assert.equal(database.isReady(), false);
  database.pool.handlers.connect();
  assert.equal(database.isReady(), true);
  await database.close();
  assert.deepEqual(calls, ['SELECT 1 AS ready', 'end']);
  assert.equal(database.isReady(), false);
});

test('mapProduct dựng đúng contract API từ dòng PostgreSQL (json_agg + numeric)', () => {
  const product = mapProduct({
    ProductId: 19, Name: 'Kệ inox 4 tầng', CategoryKey: 'luu-tru', CategoryLabel: 'Kệ inox & lưu trữ',
    Price: '750000', OldPrice: null, Rating: '4.8', Sold: 25, Badge: 'hot',
    Description: 'Kệ inox 4 tầng còn chắc chắn.', ImageUrl: '/images/products/ke-inox-4-tang.jpg',
    ImagesJson: [{ url: '/images/products/ke-inox-4-tang.jpg' }],
    SpecsJson: [{ text: 'Inox 304' }],
  });
  assert.deepEqual(product, {
    id: 19, name: 'Kệ inox 4 tầng', category: 'luu-tru', categoryLabel: 'Kệ inox & lưu trữ',
    price: 750000, oldPrice: null, rating: 4.8, sold: 25, badge: 'hot',
    description: 'Kệ inox 4 tầng còn chắc chắn.', image: '/images/products/ke-inox-4-tang.jpg',
    images: ['/images/products/ke-inox-4-tang.jpg'], specs: ['Inox 304'],
  });
  /* Chuỗi JSON (pg có thể trả text tuỳ cấu hình) vẫn parse được như trước. */
  assert.deepEqual(mapProduct({
    ProductId: 1, Name: 'SP', CategoryKey: 'ban-ghe', CategoryLabel: 'Bàn ghế',
    Price: 1000, OldPrice: 2000, Rating: 4.5, Sold: 1, Badge: null,
    Description: 'Mô tả', ImageUrl: null,
    ImagesJson: '[{"url":"/images/a.jpg"}]', SpecsJson: '[{"text":"Đặc tả"}]',
  }).images, ['/images/a.jpg']);
});

test('catalog repository bind input qua $1/$2 — không nối giá trị người dùng vào SQL', async () => {
  const seen = [];
  const pool = {
    query: async (text, values) => {
      seen.push({ text, values });
      return { rows: [] };
    },
  };
  const repo = createCatalogRepository({ pool });

  await repo.listProducts({ cat: "ban-ghe' OR 1=1--", q: "x'; DROP TABLE products;--", sort: 'price-asc' });
  const first = seen[0];
  assert.match(first.text, /WHERE p\.category_key = \$1 AND extensions\.unaccent\(p\.name\) ILIKE extensions\.unaccent\(\$2\)/);
  assert.match(first.text, /FROM app\.products/);
  assert.equal(first.values[0], "ban-ghe' OR 1=1--");
  assert.equal(first.values[1], "%x'; DROP TABLE products;--%");
  assert.match(first.text, /ORDER BY p\.price ASC, p\.product_id ASC/);
  assert.ok(!first.text.includes("'ban-ghe"));
  assert.ok(!first.text.includes('DROP TABLE'));

  await repo.listCategories();
  assert.match(seen[1].text, /FROM app\.categories ORDER BY category_key ASC/);

  await repo.getProductById('19');
  assert.deepEqual(seen[2].values, [19]);
  assert.match(seen[2].text, /WHERE p\.product_id = \$1/);

  await repo.listRelatedProducts('luu-tru', 19, 4);
  assert.match(seen[3].text, /LIMIT \$3/);
  assert.deepEqual(seen[3].values, ['luu-tru', 19, 4]);
});

test('order repository gọi fn_tao_don_hang với items jsonb và map đúng contract API', async () => {
  let captured;
  const pool = {
    query: async (text, values) => {
      captured = { text, values };
      return {
        rows: [{
          order_id: 7, order_code: 'DI00000042', delivery_method: 'standard', payment_method: 'cod',
          promo_code: 'QUANGHUY10', subtotal: '860000', shipping_fee: '30000', discount: '86000', total: '804000',
          customer_name: 'Nguyễn Văn A', customer_phone: '0901234567', customer_address: '12 Lê Lợi',
          note: 'Gọi trước khi giao', created_at: new Date('2026-09-25T08:00:00.000Z'),
          items: [{ id: 19, name: 'Kệ inox 4 tầng', price: 750000, qty: 1 }],
        }],
      };
    },
  };
  const order = await createOrderRepository({ pool }).createOrder({
    items: [{ id: 19, qty: 1 }, { id: 19, qty: 2 }],
    delivery: 'standard', payment: 'cod', promoCode: 'QUANGHUY10',
    customer: { name: 'Nguyễn Văn A', phone: '0901234567', address: '12 Lê Lợi', note: 'Gọi trước khi giao' },
  });
  assert.equal(captured.text, 'SELECT * FROM app.fn_tao_don_hang($1, $2, $3, $4, $5, $6, $7, $8::jsonb)');
  assert.equal(captured.values[3], 'standard');
  assert.equal(captured.values[5], 'QUANGHUY10');
  assert.deepEqual(JSON.parse(captured.values[7]), [{ id: 19, qty: 1 }, { id: 19, qty: 2 }]);
  assert.deepEqual(order, {
    code: 'DI00000042',
    items: [{ id: 19, name: 'Kệ inox 4 tầng', price: 750000, qty: 1 }],
    delivery: 'standard', payment: 'cod', promoCode: 'QUANGHUY10',
    subtotal: 860000, shippingFee: 30000, discount: 86000, total: 804000,
    customer: { name: 'Nguyễn Văn A', phone: '0901234567', address: '12 Lê Lợi', note: 'Gọi trước khi giao' },
    createdAt: '2026-09-25T08:00:00.000Z',
  });
});

test('order repository ánh xạ lỗi nghiệp vụ P0001 → 400, lỗi khác giữ nguyên cho handler 503', async () => {
  const pool = {
    query: async () => {
      const error = new Error('Giỏ hàng trống.');
      error.code = 'P0001';
      throw error;
    },
  };
  await assert.rejects(
    createOrderRepository({ pool }).createOrder({
      items: [], delivery: 'standard', payment: 'cod',
      customer: { name: 'A B', phone: '0901234567', address: '12 Lê Lợi', note: '' },
    }),
    (error) => error.isBusinessError === true && error.status === 400 && error.message === 'Giỏ hàng trống.',
  );

  const poolUnavailable = {
    query: async () => {
      const error = new Error('connection terminated');
      error.code = 'ECONNREFUSED';
      throw error;
    },
  };
  await assert.rejects(
    createOrderRepository({ pool: poolUnavailable }).createOrder({
      items: [{ id: 1, qty: 1 }], delivery: 'standard', payment: 'cod',
      customer: { name: 'A B', phone: '0901234567', address: '12 Lê Lợi', note: '' },
    }),
    (error) => error.isBusinessError === undefined && error.status === undefined,
  );
});

test('migration PostgreSQL không destructive, không temp table và khóa quyền runtime', () => {
  const migrationsDir = path.resolve(__dirname, '..', 'database', 'postgres', 'migrations');
  const files = fs.readdirSync(migrationsDir).sort();
  assert.deepEqual(files, ['001_initial_schema.sql', '002_runtime_permissions.sql']);
  const schema = fs.readFileSync(path.join(migrationsDir, files[0]), 'utf8');
  const permissions = fs.readFileSync(path.join(migrationsDir, files[1]), 'utf8');
  assert.doesNotMatch(schema, /\bDROP\s+(TABLE|SCHEMA|VIEW|FUNCTION)\b/i);
  assert.doesNotMatch(schema, /CREATE\s+TEMP/i);
  assert.match(schema, /CREATE OR REPLACE FUNCTION app\.fn_tao_don_hang/);
  assert.match(schema, /SECURITY DEFINER\s+SET search_path = ''/);
  assert.match(schema, /EXCEPTION WHEN unique_violation/);
  assert.match(schema, /UNIQUE \(order_id, product_id\)/);
  assert.match(schema, /customer_phone.*CHECK \(customer_phone ~ '\^0\[0-9\]\{9\}\$'/s);
  assert.match(permissions, /REVOKE ALL ON ALL TABLES IN SCHEMA app FROM PUBLIC/);
  assert.match(permissions, /GRANT EXECUTE ON FUNCTION app\.fn_tao_don_hang/);
  assert.doesNotMatch(permissions, /GRANT (INSERT|UPDATE|DELETE).*app\.orders/i);
});

test('migration runner dùng advisory lock/checksum và seed fixture đúng 6/21/1/84', () => {
  const runner = fs.readFileSync(path.resolve(__dirname, '..', 'database', 'postgres', 'apply-schema.js'), 'utf8');
  assert.match(runner, /MIGRATION_DATABASE_URL/);
  assert.match(runner, /pg_advisory_lock/);
  assert.match(runner, /schema_migrations/);
  assert.match(runner, /checksum đã thay đổi/);
  assert.doesNotMatch(runner, /process\.env\.DATABASE_URL/);

  const catalog = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'data', 'products.json'), 'utf8'));
  const validated = validateCatalog(catalog);
  assert.deepEqual(EXPECTED, { categories: 6, products: 21, images: 1, specs: 84 });
  assert.equal(validated.categories.length, 6);
  assert.equal(validated.products.length, 21);
  assert.throws(() => validateCatalog({ categories: [], products: [] }), /Fixture catalog/);
});

test('migration SQL không gọi construct parser (coalesce/nullif/greatest/least) có tiền tố schema', () => {
  /* COALESCE/NULLIF/GREATEST/LEAST là construct của parser, không có entry trong pg_proc:
   * chỉ nhận dạng khi gọi KHÔNG tiền tố; viết pg_catalog.coalesce(...) luôn lỗi 42883
   * "function does not exist" trên PostgreSQL thật (stub pg trong test không bắt được).
   * Chi tiết: docs/tasks/2026-09-26-sua-migration-postgresql-coalesce-42883.md */
  const dir = path.resolve(__dirname, '..', 'database', 'postgres', 'migrations');
  const files = fs.readdirSync(dir)
    .filter((name) => /^\d{3}_[a-z0-9_-]+\.sql$/.test(name))
    .sort();
  assert.ok(files.length >= 1, 'Phải có ít nhất một file migration trong database/postgres/migrations.');
  for (const file of files) {
    const source = fs.readFileSync(path.join(dir, file), 'utf8');
    assert.doesNotMatch(
      source,
      /pg_catalog\s*\.\s*(coalesce|nullif|greatest|least)\s*\(/i,
      `${file} gọi construct parser có tiền tố schema — luôn lỗi 42883 trên PostgreSQL thật.`,
    );
  }
});

