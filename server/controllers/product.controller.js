'use strict';

/* CONTROLLER — GET /api/products (danh sách, lọc/tìm/sắp xếp)
 *           — GET /api/products/:id (chi tiết + sản phẩm liên quan) */

const { getServices } = require('../models');
const { databaseUnavailable } = require('./helpers');

const listProducts = async (req, res, next) => {
  try {
    const services = getServices();
    if (!services) return databaseUnavailable(res);
    const list = await services.catalogRepository.listProducts(req.query || {});
    res.set('Cache-Control', 'public, max-age=30');
    return res.json(list);
  } catch (error) {
    error.isDatabaseError = true;
    return next(error);
  }
};

const getProduct = async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
  }
  try {
    const services = getServices();
    if (!services) return databaseUnavailable(res);
    const product = await services.catalogRepository.getProductById(id);
    if (!product) {
      return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
    }
    const related = await services.catalogRepository.listRelatedProducts(product.category, product.id, 4);
    res.set('Cache-Control', 'public, max-age=30');
    return res.json({ product, related });
  } catch (error) {
    error.isDatabaseError = true;
    return next(error);
  }
};

module.exports = { listProducts, getProduct };
