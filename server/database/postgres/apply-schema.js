'use strict';

/* Runner migration an toàn: chỉ đọc MIGRATION_DATABASE_URL, khóa advisory theo session,
 * mỗi file chạy trong transaction và checksum đã áp không được thay đổi. */
try { process.loadEnvFile(); } catch { /* dùng env của shell/secret store */ }

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { ConfigError, createConfig } = require('../../lib/db');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const checksum = (source) => crypto.createHash('sha256').update(source).digest('hex');

const run = async ({ pgModule } = {}) => {
  const pg = pgModule || require('pg');
  const config = createConfig({ urlEnv: 'MIGRATION_DATABASE_URL' });
  const pool = new pg.Pool({ ...config, max: 1 });
  let client;
  try {
    client = await pool.connect();
    await client.query("SELECT pg_advisory_lock(hashtext('do-cu-quang-huy:migrations'))");
    await client.query('CREATE SCHEMA IF NOT EXISTS app');
    await client.query(`CREATE TABLE IF NOT EXISTS app.schema_migrations (
      version text PRIMARY KEY,
      checksum char(64) NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);

    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter((name) => /^\d{3}_[a-z0-9_-]+\.sql$/.test(name))
      .sort();
    for (const file of files) {
      const source = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      const digest = checksum(source);
      const existing = await client.query(
        'SELECT checksum FROM app.schema_migrations WHERE version = $1', [file],
      );
      if (existing.rows[0]) {
        if (existing.rows[0].checksum !== digest) {
          throw new ConfigError(`Migration ${file} đã áp nhưng checksum đã thay đổi.`);
        }
        continue;
      }
      await client.query('BEGIN');
      try {
        await client.query(source);
        await client.query(
          'INSERT INTO app.schema_migrations(version, checksum) VALUES ($1, $2)', [file, digest],
        );
        await client.query('COMMIT');
        console.log(`[migration] applied=${file}`);
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      }
    }
  } finally {
    if (client) {
      await client.query("SELECT pg_advisory_unlock(hashtext('do-cu-quang-huy:migrations'))").catch(() => {});
      client.release();
    }
    await pool.end().catch(() => {});
  }
};

if (require.main === module) {
  run().catch((error) => {
    if (error instanceof ConfigError) console.error(`[config] ${error.message}`);
    else console.error(`[migration] Thất bại: ${String(error && error.code || 'MIGRATION_FAILED')}`);
    process.exitCode = 1;
  });
}

module.exports = { run, checksum, MIGRATIONS_DIR };
