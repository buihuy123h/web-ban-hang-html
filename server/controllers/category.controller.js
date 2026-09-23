'use strict';

/* CONTROLLER — GET /api/categories */

const { getServices } = require('../models');
const { databaseUnavailable } = require('./helpers');

const listCategories = async (req, res, next) => {
  try {
    const services = getServices();
    if (!services) return databaseUnavailable(res);
    const list = await services.catalogRepository.listCategories();
    res.set('Cache-Control', 'public, max-age=30');
    return res.json(list);
  } catch (error) {
    error.isDatabaseError = true;
    return next(error);
  }
};

module.exports = { listCategories };
