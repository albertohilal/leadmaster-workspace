const express = require('express');
const router = express.Router();
const listenerController = require('../controllers/listenerController');
const { authenticate } = require('../../auth/middleware/authMiddleware');

// Todas las rutas de listener requieren autenticación
router.use(authenticate);

// Endpoint de prueba para mensajes entrantes reales
router.post('/test-message', listenerController.testMessage);

// Control de intervención humana
router.post('/human-intervention', listenerController.registerHumanIntervention);

// Habilitar/deshabilitar IA para un lead
router.post('/ia/enable', listenerController.enableIA);
router.post('/ia/disable', listenerController.disableIA);
router.post('/ia/reactivate', listenerController.reactivateIA);
router.post('/reactivate-ia', listenerController.reactivateIA);

// Historial de intervenciones
router.get('/history/:telefono', listenerController.getInterventionHistory);

// Rutas para el listener
router.get('/status', listenerController.getStatus);
router.post('/mode', listenerController.setMode);
router.get('/logs', listenerController.getLogs);

module.exports = router;
