const express = require('express');
const router = express.Router();
const listenerController = require('../controllers/listenerController');
const incomingMessageController = require('../controllers/incomingMessageController');
const { authenticate } = require('../../auth/middleware/authMiddleware');

function internalListenerTokenGuard(req, res, next) {
	const expectedToken = process.env.INTERNAL_LISTENER_TOKEN;
	if (!expectedToken) return next();

	const providedToken = req.get('X-Internal-Token');
	if (!providedToken || providedToken !== expectedToken) {
		return res.status(401).json({
			error: true,
			code: 'UNAUTHORIZED',
			message: 'Invalid internal token'
		});
	}

	return next();
}

// Endpoint interno (session-manager -> central-hub). Sin JWT para no romper integración.
// Contrato: POST /incoming-message (a nivel del módulo: /api/listener/incoming-message)
router.post('/incoming-message', internalListenerTokenGuard, incomingMessageController.incomingMessage);

// Bonus: persistencia de salientes (OUT)
router.post('/outgoing-message', internalListenerTokenGuard, incomingMessageController.outgoingMessage);

// Todas las demás rutas de listener requieren autenticación
router.use(authenticate);

// Endpoint de prueba para mensajes entrantes reales
router.post('/test-message', listenerController.testMessage);

// Control de intervención humana
router.post('/human-intervention', listenerController.registerHumanIntervention);

// Habilitar/deshabilitar IA para un lead
router.post('/ia/enable', listenerController.enableIA);
router.post('/ia/disable', listenerController.disableIA);
router.post('/ia/reactivate', listenerController.reactivateIA);

// Historial de intervenciones
router.get('/history/:telefono', listenerController.getInterventionHistory);

// Debug/manual inspection (JWT)
router.get('/messages', incomingMessageController.listMessages);

// Rutas para el listener
router.get('/status', listenerController.getStatus);
router.post('/mode', listenerController.setMode);
router.get('/logs', listenerController.getLogs);

module.exports = router;
