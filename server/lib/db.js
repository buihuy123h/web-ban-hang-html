'use strict';

const fs = require('node:fs');
const { IS_TEST } = require('../config');

class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigError';
    this.code = 'INVALID_CONFIG';
    this.isConfigError = true;
  }
}

const parseInteger = (name, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) => {
  const raw = process.env[name];
  const value = raw == null || raw === '' ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new ConfigError(`${name} phải là số nguyên từ ${min} đến ${max}.`);
  }
  return value;
};

const isLoopbackHost = (host) => {
  const value = String(host || '').toLowerCase();
  return value === 'localhost' || value === '::1' || value.startsWith('127.');
};

/* Mã lỗi an toàn cho log: chỉ giữ code/name khớp pattern (như index.js), còn lại → DB_ERROR
 * — không bao giờ đưa message lỗi (có thể chứa credential) vào log. */
const SAFE_ERROR_CODE = /^[A-Z0-9_.-]{1,64}$/i;
const sanitizeErrorCode = (error) => {
  const candidate = String((error && (error.code || error.name)) || '');
  return SAFE_ERROR_CODE.test(candidate) ? candidate : 'DB_ERROR';
};


const parseDatabaseUrl = (raw, envName = 'DATABASE_URL') => {
  let url;
  try { url = new URL(raw); } catch { throw new ConfigError(`${envName} không phải URL PostgreSQL hợp lệ.`); }
  if (!/^postgres(ql)?:$/.test(url.protocol)) {
    throw new ConfigError(`${envName} phải bắt đầu bằng postgres:// hoặc postgresql://.`);
  }
  if (!url.hostname || !url.username || !url.pathname || url.pathname === '/') {
    throw new ConfigError(`${envName} phải có hostname, username và database.`);
  }
  let database;
  let user;
  let password;
  try {
    database = decodeURIComponent(url.pathname.slice(1));
    user = decodeURIComponent(url.username);
    password = decodeURIComponent(url.password);
  } catch {
    throw new ConfigError(`${envName} chứa percent-encoding không hợp lệ.`);
  }
  if (!database || database.includes('/')) throw new ConfigError(`${envName} có tên database không hợp lệ.`);
  if (!isLoopbackHost(url.hostname) && !password) {
    throw new ConfigError(`${envName} phải có mật khẩu khi kết nối host từ xa.`);
  }
  const defaultSslMode = isLoopbackHost(url.hostname) ? 'disable' : '';
  const sslMode = String(url.searchParams.get('sslmode') || defaultSslMode).toLowerCase();
  if (!['disable', 'require', 'verify-ca', 'verify-full'].includes(sslMode)) {
    throw new ConfigError(`${envName} phải khai báo sslmode=require, verify-ca hoặc verify-full cho host từ xa.`);
  }
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 5432,
    database,
    user,
    password,
    sslMode,
  };
};

const createConfig = ({ urlEnv = 'DATABASE_URL' } = {}) => {
  const rawUrl = String(process.env[urlEnv] || '').trim();
  if (!rawUrl) throw new ConfigError(`${urlEnv} không được để trống.`);
  const base = parseDatabaseUrl(rawUrl, urlEnv);
  const production = process.env.NODE_ENV === 'production';
  if ((production || !isLoopbackHost(base.host)) && base.sslMode === 'disable') {
    throw new ConfigError(`${urlEnv} phải bật TLS bằng sslmode=require hoặc verify-full.`);
  }

  let ssl;
  if (base.sslMode !== 'disable') {
    const caPath = String(process.env.PGSSL_CA || '').trim();
    if (base.sslMode === 'verify-ca' || base.sslMode === 'verify-full') {
      if (!caPath) throw new ConfigError('PGSSL_CA bắt buộc khi sslmode=verify-ca/verify-full.');
      try { ssl = { ca: fs.readFileSync(caPath, 'utf8'), rejectUnauthorized: true }; }
      catch { throw new ConfigError('PGSSL_CA không đọc được file CA.'); }
    } else {
      ssl = { rejectUnauthorized: false };
    }
  }

  /* Cấu hình tự kết nối lại khi mất kết nối DB runtime (fail-fast khi env sai). */
  const reconnectMinMs = parseInteger('DB_RECONNECT_MIN_MS', 2000, { min: 100, max: 60000 });
  const reconnectMaxMs = parseInteger('DB_RECONNECT_MAX_MS', 30000, { min: 1000, max: 600000 });
  if (reconnectMinMs > reconnectMaxMs) {
    throw new ConfigError('DB_RECONNECT_MIN_MS phải nhỏ hơn hoặc bằng DB_RECONNECT_MAX_MS.');
  }

  return {
    host: base.host,
    port: base.port,
    database: base.database,
    user: base.user,
    password: base.password,
    ...(ssl ? { ssl } : {}),
    application_name: 'do-cu-quang-huy',
    max: parseInteger('PGPOOL_MAX', 10, { min: 1, max: 100 }),
    idleTimeoutMillis: parseInteger('PGPOOL_IDLE_TIMEOUT_MS', 30000, { min: 1000, max: 300000 }),
    connectionTimeoutMillis: parseInteger('PG_CONNECT_TIMEOUT_MS', 10000, { min: 1000, max: 120000 }),
    query_timeout: parseInteger('PG_QUERY_TIMEOUT_MS', 15000, { min: 1000, max: 300000 }),
    reconnectMinMs,
    reconnectMaxMs,
  };
};

const createDatabase = ({ pgModule, config, reconnect, log } = {}) => {
  const resolved = config || createConfig();
  const pg = pgModule || require('pg');
  /* 2 field cấu hình reconnect không phải option của pg.Pool → tách riêng trước khi dựng pool. */
  const { reconnectMinMs, reconnectMaxMs, ...poolOptions } = resolved;
  /* Reconnect mặc định TẮT khi chạy test (IS_TEST) — test muốn chạy phải tiêm option rõ ràng. */
  const reconnectOption = reconnect && typeof reconnect === 'object' ? reconnect : {};
  const reconnectConf = {
    enabled: typeof reconnectOption.enabled === 'boolean' ? reconnectOption.enabled : !IS_TEST,
    minMs: Number.isFinite(reconnectOption.minMs) ? reconnectOption.minMs
      : (Number.isFinite(reconnectMinMs) ? reconnectMinMs : 2000),
    maxMs: Number.isFinite(reconnectOption.maxMs) ? reconnectOption.maxMs
      : (Number.isFinite(reconnectMaxMs) ? reconnectMaxMs : 30000),
  };
  if (reconnectConf.minMs > reconnectConf.maxMs) {
    throw new ConfigError('DB_RECONNECT_MIN_MS phải nhỏ hơn hoặc bằng DB_RECONNECT_MAX_MS.');
  }
  /* Hàm log tiêm được (test bắt nội dung) — mặc định console; mọi dòng 1 dòng key=value, không secret. */
  const emit = typeof log === 'function' ? log : (message) => console.error(message);

  const pool = new pg.Pool(poolOptions);
  let ready = false;
  let closed = false;
  let probeTimer = null; // timer probe đang hẹn — duy nhất 1 chuỗi probe tồn tại tại một thời điểm
  let probing = false;   // probe đang chạy (đang await pool.query)
  let attempt = 0;       // số lần probe đã thử kể từ lần pool lỗi gần nhất

  /* Hẹn probe kế tiếp — no-op nếu reconnect tắt / đã close / đã có chuỗi probe đang chờ. */
  const scheduleProbe = (delayMs) => {
    if (!reconnectConf.enabled || closed || probing || probeTimer !== null) return;
    const timer = setTimeout(() => {
      probeTimer = null;
      runProbe().catch(() => { /* phòng hờ: không bao giờ để unhandled rejection */ });
    }, delayMs);
    timer.unref?.(); // không giữ process sống chỉ vì probe đang chờ
    probeTimer = timer;
  };

  /* Probe kết nối lại bằng đúng query SELECT 1 AS ready:
   * - thành công → ready=true, reset backoff, log reconnect_ok;
   * - thất bại → log reconnect_fail + hẹn tiếp với delay luỹ tiến min(minMs * 2^n, maxMs). */
  const runProbe = async () => {
    if (closed) return;
    probing = true;
    const currentAttempt = attempt + 1;
    attempt = currentAttempt;
    let queryError = null;
    try {
      await pool.query('SELECT 1 AS ready');
    } catch (error) {
      queryError = error;
    }
    probing = false;
    if (closed) return; // close() trong lúc probe đang chờ → không đổi state, không log thêm
    if (queryError) {
      const nextDelayMs = Math.min(reconnectConf.minMs * 2 ** currentAttempt, reconnectConf.maxMs);
      emit(`[database] reconnect_fail attempt=${currentAttempt} code=${sanitizeErrorCode(queryError)} next_delay_ms=${nextDelayMs}`);
      scheduleProbe(nextDelayMs);
      return;
    }
    ready = true;
    attempt = 0; // reset backoff: lần mất kết nối kế tiếp bắt đầu lại từ minMs
    emit(`[database] reconnect_ok attempt=${currentAttempt}`);
  };

  pool.on('error', (error) => {
    ready = false; // hạ readiness ngay lập tức
    try {
      emit(`[database] pool_error code=${sanitizeErrorCode(error)}`);
      scheduleProbe(reconnectConf.minMs); // probe đầu tiên sau minMs (no-op nếu probe đã hẹn/chạy)
    } catch { /* hàm log tiêm ngoài tự ném lỗi → bỏ qua, không làm sập process */ }
  });
  pool.on('connect', () => { ready = true; });

  return {
    pool, pg,
    async connect() {
      await pool.query('SELECT 1 AS ready');
      ready = true;
      return pool;
    },
    async close() {
      closed = true; // chặn probe/log mới sau close
      ready = false;
      if (probeTimer !== null) {
        clearTimeout(probeTimer); // clear timer TRƯỚC pool.end()
        probeTimer = null;
      }
      await pool.end();
    },
    isReady() { return ready; },
    /* Đo độ trễ 1 vòng query SELECT 1 (ms, float) — dùng cho deep health; lỗi query → ném lỗi. */
    async ping() {
      const startedAt = process.hrtime.bigint();
      await pool.query('SELECT 1 AS ready');
      return Number(process.hrtime.bigint() - startedAt) / 1e6;
    },
  };
};

module.exports = { ConfigError, createConfig, createDatabase, parseDatabaseUrl, parseInteger };
