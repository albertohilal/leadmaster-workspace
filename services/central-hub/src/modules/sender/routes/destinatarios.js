const express = require('express');
const router = express.Router();
const destinatariosController = require('../controllers/destinatariosController');
const { authenticate } = require('../../auth/middleware/authMiddleware');

// Aplicar middleware de autenticación a todas las rutas
router.use(authenticate);

// Obtener destinatarios completos de una campaña
router.get('/campania/:campaniaId', destinatariosController.getDestinatariosCampania);

// Obtener solo resumen de destinatarios de una campaña
router.get('/campania/:campaniaId/resumen', destinatariosController.getResumenDestinatarios);

// Agregar destinatarios a una campaña
router.post('/campania/:campaniaId/agregar', destinatariosController.agregarDestinatarios);

// Quitar destinatarios de una campaña
router.delete('/campania/:campaniaId/quitar', destinatariosController.quitarDestinatarios);

// ❌ RUTA ELIMINADA - Violaba política de estados
// router.patch('/:destinatarioId/marcar-enviado', destinatariosController.marcarEnviadoManual);
// Reemplazada por: POST /envios/:id/manual/confirm (TAREA 3)

module.exports = router;