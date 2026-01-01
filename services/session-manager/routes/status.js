import express from 'express';
import { getStatus } from '../whatsapp/client.js';

const router = express.Router();

/**
 * GET /status
 * Returns WhatsApp session status
 */
router.get('/', (req, res) => {
  try {
    const status = getStatus();
    res.status(200).json(status);
  } catch (error) {
    res.status(500).json({
      error: true,
      code: 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

export default router;
