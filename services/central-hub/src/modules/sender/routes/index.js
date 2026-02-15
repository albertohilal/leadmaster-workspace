/**
 * Rutas principales del módulo Sender
 * Central Hub – LeadMaster
 *
 * - Todas las rutas requieren autenticación
 * - Conviven rutas nuevas (arquitectura actual)
 *   y rutas legacy (en migración)
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../../auth/middleware/authMiddleware');

// ==================================================
// Seguridad
// ==================================================
router.use(authenticate);

// ==================================================
// Health / Status del módulo
// ==================================================
router.get('/status', (req, res) => {
  res.json({ status: 'sender module ok' });
});

// ==================================================
// RUTAS NUEVAS (arquitectura actual)
// ==================================================

// Campañas (nuevo modelo)
router.use('/campaigns', require('./campaigns'));

// Mensajes (envío controlado vía session-manager)
router.use('/messages', require('./messages'));

// Envío directo vía Session Manager (HTTP)
router.use('/', require('./sender.routes'));

// Prueba controlada de envío (DRY RUN / validación sesión)
// Endpoint final:
// POST /api/sender/test-send
router.use('/', require('./testSend.route'));

// ❌ RUTA LEGACY ELIMINADA - Violaba política de estados
// router.use('/', require('./manual'));
// Reemplazada por:
// - GET /api/envios/:id/manual/prepare (TAREA 2)
// - POST /api/envios/:id/manual/confirm (TAREA 3)

// ==================================================
// RUTAS LEGACY (en migración)
// ==================================================

router.use('/auth', require('./auth'));
router.use('/campanias', require('./campanias'));
router.use('/envios', require('./envios'));
router.use('/programaciones', require('./programaciones'));
router.use('/usuarios', require('./usuarios'));
router.use('/sesiones', require('./sesiones'));
router.use('/lugares', require('./lugares'));
router.use('/rubros', require('./rubros'));
router.use('/destinatarios', require('./destinatarios'));
router.use('/prospectos', require('./prospectos'));

module.exports = router;
