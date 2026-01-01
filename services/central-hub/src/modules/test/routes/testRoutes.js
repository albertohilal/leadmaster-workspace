const express = require('express');
const router = express.Router();

/**
 * @route GET /api/test/ping
 * @description Endpoint de prueba simple sin autenticación
 */
router.get('/ping', (req, res) => {
  res.json({
    success: true,
    message: 'Pong! Servidor funcionando',
    timestamp: new Date().toISOString(),
    server: 'leadmaster-central-hub'
  });
});

/**
 * @route GET /api/test/db
 * @description Probar conexión a base de datos
 */
router.get('/db', async (req, res) => {
  try {
    const db = require('../../config/db');
    const [result] = await db.execute('SELECT 1 as test');
    
    res.json({
      success: true,
      message: 'Conexión a DB exitosa',
      result: result[0],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error conectando a DB:', error);
    res.status(500).json({
      success: false,
      message: 'Error de conexión a DB',
      error: error.message
    });
  }
});

module.exports = router;