'use strict';

/* ROUTES — gộp toàn bộ router API; app.js mount nguyên khối này tại /api
 * (sau rate limit, trước 404 JSON). */

const express = require('express');
const healthRoutes = require('./health.routes');
const categoryRoutes = require('./categories.routes');
const productRoutes = require('./products.routes');
const orderRoutes = require('./orders.routes');
const chatRoutes = require('./chat.routes');

const apiRouter = express.Router();
apiRouter.use(healthRoutes);
apiRouter.use(categoryRoutes);
apiRouter.use(productRoutes);
apiRouter.use(orderRoutes);
apiRouter.use(chatRoutes);

module.exports = apiRouter;
