/**
 * Rutas del módulo Mailer
 * - Todas requieren autenticación
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../../auth/middleware/authMiddleware');

router.use(authenticate);

router.use('/', require('./mailer.routes'));

module.exports = router;
