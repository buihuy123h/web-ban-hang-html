'use strict';

/* ROUTE — /api/products, /api/products/:id */

const express = require('express');
const { listProducts, getProduct } = require('../controllers/product.controller');

const router = express.Router();
router.get('/products', listProducts);
router.get('/products/:id', getProduct);

module.exports = router;
