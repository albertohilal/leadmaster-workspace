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
    res.status(200).json({
      status: 'ok',
      service: 'session-manager',
      cliente_id: status.cliente_id,
      whatsapp_state: status.state
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      service: 'session-manager',
      error: error.message
    });
  }
});

export default router;
