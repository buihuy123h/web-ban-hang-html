'use strict';

/**
 * ENTRY POINT — backend Đồ Cũ Quang Huy.
 * Chạy: `node index.js` · `npm start` · `npm run dev` (trong thư mục server/).
 * Trách nhiệm duy nhất của file này: nạp .env → startServer (kết nối SQL Server,
 * listen) → đăng ký graceful shutdown. Cấu trúc chi tiết xem comment đầu app.js.
 */

/* Nạp biến môi trường từ server/.env (builtin Node ≥ 20.12). Thiếu file → bỏ qua.
 * Phải chạy trước require('./app') vì lib/chat.js đọc XKIRO_* ngay khi load. */
try { process.loadEnvFile(); } catch { /* chưa có server/.env — dùng mặc định */ }

const { ConfigError } = require('./lib/db');

let appRuntime = null;
const loadApp = () => {
  if (!appRuntime) appRuntime = require('./app');
  return appRuntime;
};

const safeShutdown = (signal, exitCode = 0) => {
  try {
    return loadApp().shutdown(signal, exitCode);
  } catch {
    // Nếu chính module app không load được vì config sai, không có server/pool cần đóng.
    return process.exit(exitCode);
  }
};

const bootstrap = async () => {
  try {
    await loadApp().startServer();
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(`[config] ${error.message}`);
    } else {
      const candidate = String(error && (error.code || error.name) || '');
      const code = /^[A-Z0-9_.-]{1,64}$/i.test(candidate) ? candidate : 'CONNECT_FAILED';
      console.error(`[database] Không thể kết nối SQL Server: ${code}`);
    }
    process.exitCode = 1;
  }
};

let handlersRegistered = false;
const registerGracefulShutdown = () => {
  if (handlersRegistered) return;
  handlersRegistered = true;
  process.on('SIGINT', () => safeShutdown('SIGINT'));
  process.on('SIGTERM', () => safeShutdown('SIGTERM'));
  const fatal = (kind) => (error) => {
    const rawCode = error && (error.code || error.name);
    const candidate = String(rawCode || '');
    const code = /^[A-Z0-9_.-]{1,64}$/i.test(candidate) ? candidate : 'FATAL_ERROR';
    console.error(`[fatal] kind=${kind} code=${code}`);
    safeShutdown(kind, 1);
  };
  process.on('uncaughtException', fatal('uncaughtException'));
  process.on('unhandledRejection', fatal('unhandledRejection'));
};

/* Chạy trực tiếp mới boot; được require (test/tool) thì không có tác dụng phụ. */
if (require.main === module) {
  bootstrap();
  registerGracefulShutdown();
}

module.exports = { bootstrap, registerGracefulShutdown };
