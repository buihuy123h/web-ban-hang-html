'use strict';

/* ROUTE — /api/categories */

const express = require('express');
const { listCategories } = require('../controllers/category.controller');

const router = express.Router();
router.get('/categories', listCategories);

module.exports = router;
