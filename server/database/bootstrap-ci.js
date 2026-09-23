'use strict';

/* Chỉ dựng SQL Server tạm trong CI. Không dùng script này với production/staging. */
const fs = require('node:fs');
const path = require('node:path');
const sql = require('mssql');

const required = (name) => {
  const value = String(process.env[name] || '');
  if (!value) throw new Error(`Thiếu biến môi trường ${name}.`);
  return value;
};
const bool = (name) => /^(true|1|yes)$/i.test(String(process.env[name] || ''));
const identifier = (name, value) => {
  if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(value)) throw new Error(`${name} không hợp lệ.`);
  return value;
};

const run = async () => {
  if (!bool('CI')) throw new Error('bootstrap-ci.js chỉ được chạy khi CI=true.');
  if (String(process.env.DB_AUTH_MODE || '').toLowerCase() !== 'sql') {
    throw new Error('bootstrap-ci.js yêu cầu DB_AUTH_MODE=sql.');
  }
  const server = required('DB_SERVER');
  if (!['localhost', '127.0.0.1', 'mssql', 'sqlserver'].includes(server.toLowerCase())) {
    throw new Error('DB_SERVER không phải SQL Server tạm được phép trong CI.');
  }
  const database = identifier('DB_NAME', required('DB_NAME'));
  if (database !== 'DoCuQuangHuy') throw new Error('DB_NAME CI phải là DoCuQuangHuy.');
  const adminUser = identifier('CI_SQL_ADMIN_USER', process.env.CI_SQL_ADMIN_USER || 'sa');
  const adminPassword = required('CI_SQL_ADMIN_PASSWORD');
  const runtimeUser = identifier('DB_USER', required('DB_USER'));
  const runtimePassword = required('DB_PASSWORD');
  if (runtimePassword.length > 128) throw new Error('DB_PASSWORD dài tối đa 128 ký tự.');
  if (runtimeUser.toLowerCase() === adminUser.toLowerCase()) throw new Error('DB_USER phải tách khỏi tài khoản admin CI.');

  const base = {
    server, port: Number(process.env.DB_PORT || 1433), user: adminUser, password: adminPassword,
    connectionTimeout: 30_000, requestTimeout: 60_000,
    options: { encrypt: true, trustServerCertificate: true, enableArithAbort: true },
  };
  const master = await new sql.ConnectionPool({ ...base, database: 'master' }).connect();
  let target;
  try {
    const schema = fs.readFileSync(path.join(__dirname, 'do-cu-quang-huy.sql'), 'utf8');
    const schemaBatches = schema.split(/^\s*GO\s*(?:--.*)?$/gmi).filter((part) => part.trim());
    await master.request().query(`IF DB_ID(N'${database}') IS NULL CREATE DATABASE [${database}] COLLATE Vietnamese_100_CI_AI`);
    target = await new sql.ConnectionPool({ ...base, database }).connect();
    // Hai batch đầu của file chỉ chọn master/tạo DB; target đã được tạo rõ ràng ở trên.
    for (const batch of schemaBatches.slice(2)) {
      await target.request().batch(batch.replace(/^\s*USE\s+\[DoCuQuangHuy\]\s*;?/im, ''));
    }
    await master.request()
      .input('login', sql.NVarChar(64), runtimeUser)
      .input('password', sql.NVarChar(128), runtimePassword)
      .query(`
        IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name=@login)
        BEGIN
          DECLARE @createLogin nvarchar(max) =
            N'CREATE LOGIN ' + QUOTENAME(@login) + N' WITH PASSWORD=' +
            QUOTENAME(@password, '''') + N', CHECK_POLICY=OFF';
          EXEC(@createLogin);
        END
      `);

    const quoted = `[${runtimeUser.replace(/]/g, ']]')}]`;
    await target.request().batch(`
      IF USER_ID(N'${runtimeUser}') IS NULL CREATE USER ${quoted} FOR LOGIN ${quoted};
      GRANT SELECT ON dbo.Categories TO ${quoted};
      GRANT SELECT ON dbo.Products TO ${quoted};
      GRANT SELECT ON dbo.ProductImages TO ${quoted};
      GRANT SELECT ON dbo.ProductSpecs TO ${quoted};
      GRANT EXECUTE ON dbo.usp_TaoDonHang TO ${quoted};
      GRANT EXECUTE, REFERENCES ON TYPE::dbo.OrderItemType TO ${quoted};
      DENY INSERT, UPDATE, DELETE ON dbo.Orders TO ${quoted};
      DENY INSERT, UPDATE, DELETE ON dbo.OrderItems TO ${quoted};
    `);
    console.log('[database] CI bootstrap hoàn tất; runtime user có quyền tối thiểu.');
  } finally {
    await target?.close().catch(() => {});
    await master.close().catch(() => {});
  }
};

run().catch((error) => {
  console.error(`[database] CI bootstrap thất bại: ${error.code || error.name || 'BOOTSTRAP_FAILED'}`);
  process.exitCode = 1;
});
