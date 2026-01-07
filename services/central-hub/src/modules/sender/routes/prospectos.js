const express = require('express');
const router = express.Router();
const prospectosController = require('../controllers/prospectosController');
const { authenticate } = require('../../auth/middleware/authMiddleware');

// Aplicar middleware de autenticación a todas las rutas
router.use(authenticate);

// Filtrar prospectos con criterios específicos
router.get('/filtrar', prospectosController.filtrarProspectos);

// Obtener áreas/ciudades disponibles
router.get('/areas', prospectosController.obtenerAreas);

// Obtener rubros disponibles  
router.get('/rubros', prospectosController.obtenerRubros);

// Obtener estados disponibles
router.get('/estados', prospectosController.obtenerEstados);

// Obtener estadísticas de prospectos
router.get('/estadisticas', prospectosController.obtenerEstadisticas);

module.exports = router;