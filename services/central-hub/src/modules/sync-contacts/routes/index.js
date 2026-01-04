// sync-contacts/routes/index.js
const express = require('express');
const router = express.Router();
const syncContactsController = require('../controllers/syncContactsController');
const authMiddleware = require('../../auth/middleware/authMiddleware');

// Rutas públicas (OAuth - no requieren JWT)
router.get('/authorize/:cliente_id', syncContactsController.authorize.bind(syncContactsController));
router.get('/callback', syncContactsController.callback.bind(syncContactsController));

// Rutas protegidas (requieren autenticación)
router.use(authMiddleware.authenticate);

// Sincronizar contactos manualmente
router.post('/sync/:cliente_id', syncContactsController.syncManual.bind(syncContactsController));

// Ver estado de sincronización
router.get('/status/:cliente_id', syncContactsController.status.bind(syncContactsController));

// Ver historial de sincronizaciones
router.get('/log/:cliente_id', syncContactsController.log.bind(syncContactsController));

// Actualizar configuración
router.put('/config/:cliente_id', syncContactsController.updateConfig.bind(syncContactsController));

// Revocar acceso
router.delete('/revoke/:cliente_id', syncContactsController.revoke.bind(syncContactsController));

module.exports = router;
