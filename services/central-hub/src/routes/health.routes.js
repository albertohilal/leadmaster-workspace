/**
 * Health Check Routes
 * 
 * Endpoints de salud del servicio para monitoreo
 * Accesibles sin autenticación
 */

const express = require('express');
const router = express.Router();

/**
 * GET /api/health
 * 
 * Health check endpoint para validar que el servicio está online
 * Usado por monitoreo, load balancers, etc.
 */
router.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'central-hub',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

module.exports = router;
