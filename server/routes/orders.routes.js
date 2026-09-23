'use strict';

/* ROUTE — /api/orders */

const express = require('express');
const { createOrder } = require('../controllers/order.controller');
const { orderRateLimit } = require('../middleware/rate-limit');

const router = express.Router();
router.post('/orders', orderRateLimit, createOrder);

module.exports = router;
