'use strict';

class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigError';
    this.code = 'INVALID_CONFIG';
    this.isConfigError = true;
  }
}

const parseBoolean = (name, value, fallback) => {
  if (value == null || value === '') return fallback;
  if (/^(true|1|yes)$/i.test(String(value))) return true;
  if (/^(false|0|no)$/i.test(String(value))) return false;
  throw new ConfigError(`${name} phải là boolean (true/false).`);
};

const parseInteger = (name, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) => {
  const raw = process.env[name];
  const value = raw == null || raw === '' ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new ConfigError(`${name} phải là số nguyên từ ${min} đến ${max}.`);
  }
  return value;
};

const createConfig = () => {
  const authMode = String(process.env.DB_AUTH_MODE || 'windows').trim().toLowerCase();
  if (!['windows', 'sql'].includes(authMode)) throw new ConfigError('DB_AUTH_MODE chỉ nhận windows hoặc sql.');
  const serverValue = String(process.env.DB_SERVER || '.\\SQLEXPRESS').trim();
  const database = String(process.env.DB_NAME || 'DoCuQuangHuy').trim();
  if (!serverValue) throw new ConfigError('DB_SERVER không được để trống.');
  if (!database) throw new ConfigError('DB_NAME không được để trống.');

  const encrypt = parseBoolean('DB_ENCRYPT', process.env.DB_ENCRYPT, true);
  const trustServerCertificate = parseBoolean('DB_TRUST_SERVER_CERTIFICATE', process.env.DB_TRUST_SERVER_CERTIFICATE, authMode === 'windows');
  const allowSelfSignedCi = parseBoolean('DB_ALLOW_SELF_SIGNED_CI', process.env.DB_ALLOW_SELF_SIGNED_CI, false);
  const isCi = parseBoolean('CI', process.env.CI, false);
  const isProduction = process.env.NODE_ENV === 'production';
  if ((isProduction || isCi) && !encrypt) throw new ConfigError('DB_ENCRYPT phải là true trong production/CI.');
  if (trustServerCertificate && (isProduction || isCi)) {
    const permittedCiException = isCi && authMode === 'sql' && encrypt && allowSelfSignedCi;
    if (!permittedCiException) throw new ConfigError('DB_TRUST_SERVER_CERTIFICATE phải là false; ngoại lệ CI cần DB_ALLOW_SELF_SIGNED_CI.');
  }

  const pool = {
    max: parseInteger('DB_POOL_MAX', 10, { min: 1, max: 100 }),
    min: parseInteger('DB_POOL_MIN', 0, { min: 0, max: 100 }),
    idleTimeoutMillis: parseInteger('DB_POOL_IDLE_TIMEOUT_MS', 30_000, { min: 1000, max: 300_000 }),
  };
  if (pool.min > pool.max) throw new ConfigError('DB_POOL_MIN không được lớn hơn DB_POOL_MAX.');
  const common = {
    server: serverValue,
    database,
    connectionTimeout: parseInteger('DB_CONNECT_TIMEOUT_MS', 10_000, { min: 1000, max: 120_000 }),
    requestTimeout: parseInteger('DB_REQUEST_TIMEOUT_MS', 15_000, { min: 1000, max: 300_000 }),
    pool,
  };

  if (authMode === 'sql') {
    const user = String(process.env.DB_USER || '').trim();
    const password = String(process.env.DB_PASSWORD || '');
    if (!user) throw new ConfigError('DB_USER không được để trống khi DB_AUTH_MODE=sql.');
    if (!password) throw new ConfigError('DB_PASSWORD không được để trống khi DB_AUTH_MODE=sql.');
    if (parseBoolean('DB_TRUSTED_CONNECTION', process.env.DB_TRUSTED_CONNECTION, false)) {
      throw new ConfigError('DB_TRUSTED_CONNECTION không được là true khi DB_AUTH_MODE=sql.');
    }
    const driver = process.env.DB_DRIVER == null ? '' : String(process.env.DB_DRIVER).trim();
    if (driver && !['tedious', 'mssql'].includes(driver)) throw new ConfigError('DB_DRIVER không hợp lệ với DB_AUTH_MODE=sql.');
    return {
      ...common, authMode, user, password,
      port: parseInteger('DB_PORT', 1433, { min: 1, max: 65535 }),
      options: { encrypt, trustServerCertificate, enableArithAbort: true },
    };
  }

  const driver = String(process.env.DB_DRIVER || 'msnodesqlv8').trim();
  if (driver !== 'msnodesqlv8') throw new ConfigError('Windows Authentication yêu cầu DB_DRIVER=msnodesqlv8.');
  if (!parseBoolean('DB_TRUSTED_CONNECTION', process.env.DB_TRUSTED_CONNECTION, true)) {
    throw new ConfigError('Windows Authentication yêu cầu DB_TRUSTED_CONNECTION=true.');
  }
  if (process.env.DB_USER || process.env.DB_PASSWORD) throw new ConfigError('DB_USER/DB_PASSWORD không được dùng khi DB_AUTH_MODE=windows.');
  const separator = serverValue.lastIndexOf('\\');
  const server = separator > 0 ? serverValue.slice(0, separator) : serverValue;
  const instanceName = separator > 0 ? serverValue.slice(separator + 1) : undefined;
  const port = process.env.DB_PORT ? parseInteger('DB_PORT', 1433, { min: 1, max: 65535 }) : undefined;
  const config = {
    ...common, authMode, server, ...(port ? { port } : {}),
    driver: String(process.env.DB_ODBC_DRIVER || 'ODBC Driver 18 for SQL Server').trim(),
    options: {
      trustedConnection: true, ...(instanceName && !port ? { instanceName } : {}),
      encrypt, trustServerCertificate, enableArithAbort: true,
    },
  };
  config.beforeConnect = (connection) => {
    if (trustServerCertificate && !/TrustServerCertificate=/i.test(connection.conn_str || '')) {
      connection.conn_str = `${connection.conn_str};TrustServerCertificate=Yes`;
    }
  };
  return config;
};

const createDatabase = ({ sqlModule, config } = {}) => {
  const resolved = config || createConfig();
  const authMode = resolved.authMode || 'windows';
  const driverConfig = { ...resolved };
  delete driverConfig.authMode;
  const sql = sqlModule || (authMode === 'sql' ? require('mssql') : require('mssql/msnodesqlv8'));
  const pool = new sql.ConnectionPool(driverConfig);
  let ready = false;
  pool.on('error', () => { ready = false; });
  return {
    sql, pool,
    async connect() {
      await pool.connect();
      await pool.request().query('SELECT 1 AS Ready');
      ready = true;
      return pool;
    },
    async close() {
      ready = false;
      if (pool.connected || pool.connecting) await pool.close();
    },
    isReady() { return ready && pool.connected !== false; },
  };
};

module.exports = { ConfigError, createConfig, createDatabase, parseBoolean, parseInteger };
