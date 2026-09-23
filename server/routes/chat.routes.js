'use strict';

/* ROUTE — /api/chat (trợ lý AI RAG) */

const express = require('express');
const { chatHandler } = require('../controllers/chat.controller');

const router = express.Router();
router.post('/chat', chatHandler);

module.exports = router;
