import express from 'express';
import { disconnect } from '../whatsapp/client.js';

const router = express.Router();

/**
 * POST /disconnect
 * Disconnects the WhatsApp session
 */
router.post('/', async (req, res) => {
  try {
    await disconnect();
    res.status(200).json({
      ok: true,
      message: 'WhatsApp session disconnected successfully'
    });
  } catch (error) {
    console.error('[Route:Disconnect] Error:', error);
    res.status(500).json({
      error: true,
      code: 'DISCONNECT_FAILED',
      message: error.message || 'Failed to disconnect'
    });
  }
});

export default router;
