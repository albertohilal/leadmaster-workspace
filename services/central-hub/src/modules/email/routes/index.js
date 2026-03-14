/**
 * Rutas del módulo Email
 * - Todas requieren autenticación
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../../auth/middleware/authMiddleware');

router.use(authenticate);

router.use('/', require('./email.routes'));

module.exports = router;
