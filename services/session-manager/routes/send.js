import express from 'express';
import { sendMessage, getStatus } from '../whatsapp/client.js';

const router = express.Router();

/**
 * POST /send
 * Sends a WhatsApp message
 */
router.post('/', async (req, res) => {
  try {
    const { cliente_id, to, message } = req.body;

    // Validate required fields
    if (!cliente_id || !to || !message) {
      return res.status(400).json({
        error: true,
        code: 'INVALID_REQUEST',
        message: 'Missing required fields: cliente_id, to, message'
      });
    }

    // Check session status
    const status = getStatus();
    if (status.state !== 'READY') {
      return res.status(409).json({
        error: true,
        code: 'SESSION_NOT_READY',
        message: `WhatsApp session not ready. Current state: ${status.state}`
      });
    }

    // Send message
    const result = await sendMessage(to, message);
    res.status(200).json(result);

  } catch (error) {
    console.error('[Route:Send] Error:', error);
    res.status(500).json({
      error: true,
      code: 'SEND_FAILED',
      message: error.message || 'Failed to send message'
    });
  }
});

export default router;
