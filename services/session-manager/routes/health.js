import express from 'express';
import { getStatus } from '../whatsapp/client.js';

const router = express.Router();

/**
 * GET /health
 * Health check endpoint
 */
router.get('/', (req, res) => {
  try {
    const status = getStatus();
    const isHealthy = status.state === 'READY' || status.state === 'INIT' || status.state === 'QR_REQUIRED';

    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      service: 'session-manager',
      cliente_id: status.cliente_id,
      whatsapp_state: status.state,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Route:Health] Error:', error);
    res.status(503).json({
      status: 'unhealthy',
      service: 'session-manager',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
