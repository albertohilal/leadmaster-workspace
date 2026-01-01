import express from 'express';
import { getStatus } from '../whatsapp/client.js';

const router = express.Router();

/**
 * GET /status
 * Returns the WhatsApp session status for the client
 */
router.get('/', (req, res) => {
  try {
    const status = getStatus();
    res.status(200).json(status);
  } catch (error) {
    console.error('[Route:Status] Error:', error);
    res.status(500).json({
      error: true,
      code: 'INTERNAL_ERROR',
      message: 'Failed to get status'
    });
  }
});

export default router;
