const express = require('express');
const router = express.Router();
const leadsController = require('../controllers/leadsController');
const { authenticate } = require('../../auth/middleware/authMiddleware');

// Middleware de autenticación para todas las rutas
router.use(authenticate);

/**
 * @route GET /api/sender/lugares
 * @description Obtener todos los leads para el cliente autenticado
 * @access Private (requiere JWT)
 */
router.get('/', leadsController.getLeadsByClient);

/**
 * @route GET /api/sender/lugares/filter
 * @description Obtener leads filtrados por tipo, origen, búsqueda
 * @access Private (requiere JWT)
 * @params tipo_cliente, origen, search, ia_status (query params)
 */
router.get('/filter', leadsController.getFilteredLeads);

/**
 * @route GET /api/sender/lugares/stats
 * @description Obtener estadísticas de leads por tipo
 * @access Private (requiere JWT)
 */
router.get('/stats', leadsController.getLeadsStats);

module.exports = router;
