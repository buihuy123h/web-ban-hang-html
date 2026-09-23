'use strict';

/* CONTROLLER — GET /api/health */

const { PKG } = require('../config');
const { isReady } = require('../models');

const check = (req, res) => {
  const ready = isReady();
  res.set('Cache-Control', 'no-store');
  res.status(ready ? 200 : 503).json({
    ok: ready,
    name: 'do-cu-quang-huy-api',
    version: PKG.version,
    uptime: Math.round(process.uptime()),
    time: new Date().toISOString(),
    database: ready ? 'connected' : 'disconnected',
    ...(ready ? {} : { error: 'Cơ sở dữ liệu chưa sẵn sàng.' }),
  });
};

module.exports = { check };
