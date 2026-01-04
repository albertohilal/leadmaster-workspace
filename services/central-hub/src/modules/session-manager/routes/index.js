const express = require('express');
const router = express.Router();

// Montar subrutas del session-manager
router.use('/', require('./session'));
router.use('/', require('./admin'));

module.exports = router;
