'use strict';

const crypto = require('node:crypto');

const sessions = new Map();
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const cookieName = 'qh_admin_session';

const timingSafeEqual = (left, right) => {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const parseCookies = (header = '') => Object.fromEntries(String(header).split(';').map((part) => {
  const [key, ...value] = part.trim().split('=');
  return [key, decodeURIComponent(value.join('=') || '')];
}).filter(([key]) => key));

const adminCredentials = () => ({
  username: process.env.ADMIN_USERNAME || 'admin',
  password: process.env.ADMIN_PASSWORD || '',
});

const createSession = (username) => {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { username, expiresAt: Date.now() + SESSION_TTL_MS });
  return token;
};

const getSession = (req) => {
  const token = parseCookies(req.headers.cookie)[cookieName];
  const session = token && sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    if (token) sessions.delete(token);
    return null;
  }
  return { token, ...session };
};

const setSessionCookie = (res, token) => res.set('Set-Cookie', `${cookieName}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`);
const clearSessionCookie = (res) => res.set('Set-Cookie', `${cookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);

const requireAdmin = (req, res, next) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Cần đăng nhập tài khoản quản trị.' });
  req.admin = { username: session.username };
  return next();
};

module.exports = { cookieName, adminCredentials, timingSafeEqual, createSession, getSession, setSessionCookie, clearSessionCookie, requireAdmin, sessions };