'use strict';

const express = require('express');
const controller = require('../controllers/posts.controller');

const router = express.Router();
router.get('/posts', controller.listPosts);
router.get('/posts/:slug', controller.getPost);

module.exports = router;
