/**
 * Stats Routes
 * 
 * Endpoints de estadísticas y monitoreo del sistema
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../modules/auth/middleware/authMiddleware');

/**
 * GET /api/stats/health
 * 
 * Retorna métricas de salud del sistema
 * Requiere autenticación
 */
router.get('/health', authenticate, (req, res) => {
  res.json({
    status: 'healthy',
    service: 'central-hub',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      unit: 'MB'
    },
    environment: process.env.NODE_ENV || 'development'
  });
});

/**
 * GET /api/stats/dashboard
 * 
 * Retorna estadísticas del dashboard
 * Requiere autenticación
 */
router.get('/dashboard', authenticate, async (req, res) => {
  try {
    // TODO: Implementar lógica de estadísticas reales desde la DB
    res.json({
      campaigns: {
        total: 0,
        active: 0,
        completed: 0
      },
      messages: {
        sent: 0,
        pending: 0,
        failed: 0
      },
      leads: {
        total: 0,
        contacted: 0,
        pending: 0
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      error: 'Error obteniendo estadísticas',
      message: error.message
    });
  }
});

module.exports = router;
