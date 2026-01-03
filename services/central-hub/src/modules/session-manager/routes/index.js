const express = require('express');
const router = express.Router();

// Montar subrutas del session-manager
router.use('/', require('./session'));
router.use('/', require('./admin'));

// Proxy al Session Manager externo (microservicio en localhost:3001)
router.use('/api/whatsapp', require('./whatsappQrProxy'));

module.exports = router;
