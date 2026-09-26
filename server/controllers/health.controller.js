'use strict';

/* CONTROLLER — GET /api/health
 * Hợp đồng additive (docs/tasks/2026-09-25-cai-thien-be-on-dinh-chat-luong.md mục 3.1):
 * field cũ (ok/name/version/uptime/time/database/error) giữ nguyên — chỉ THÊM
 * node/memory/pool/checks; databaseLatencyMs CHỈ xuất hiện khi ?deep=1. */

const { PKG } = require('../config');
const { isReady, getPoolStats, getDatabasePing } = require('../models');

/* Đổi byte → MB (integer, Math.round) cho khối observability memory. */
const toMb = (bytes) => Math.round(bytes / 1048576);

const check = async (req, res) => {
  const ready = isReady();
  /* Deep mode: query deep phải bằng đúng chuỗi '1' (deep=0/true/rỗng/lặp → coi như thường). */
  const deep = String(req.query.deep ?? '') === '1';
  let databaseLatencyMs = null;
  if (deep) {
    const ping = getDatabasePing();
    if (typeof ping === 'function') {
      /* Express 4 không tự bắt async error → phải try/catch ngay trong handler:
       * ping lỗi → null, KHÔNG đổi status (status vẫn theo readiness như logic cũ). */
      try {
        databaseLatencyMs = Math.max(0, Math.round(await ping()));
      } catch {
        databaseLatencyMs = null;
      }
    }
  }
  const memory = process.memoryUsage();
  res.set('Cache-Control', 'no-store');
  res.status(ready ? 200 : 503).json({
    ok: ready,
    name: 'do-cu-quang-huy-api',
    version: PKG.version,
    uptime: Math.round(process.uptime()),
    time: new Date().toISOString(),
    database: ready ? 'connected' : 'disconnected',
    node: process.version,
    memory: {
      rss_mb: toMb(memory.rss),
      heap_used_mb: toMb(memory.heapUsed),
      heap_total_mb: toMb(memory.heapTotal),
    },
    pool: getPoolStats(),
    checks: { database: ready ? 'connected' : 'disconnected' },
    ...(deep ? { databaseLatencyMs } : {}),
    ...(ready ? {} : { error: 'Cơ sở dữ liệu chưa sẵn sàng.' }),
  });
};

module.exports = { check };
