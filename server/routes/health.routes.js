'use strict';

/* ROUTE — /api/health */

const express = require('express');
const { check } = require('../controllers/health.controller');

const router = express.Router();
router.get('/health', check);

module.exports = router;
