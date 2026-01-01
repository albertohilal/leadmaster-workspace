import express from 'express';
import { getAccountInfo, getStatus } from '../whatsapp/client.js';

const router = express.Router();

/**
 * GET /account-info
 * Returns WhatsApp account information
 */
router.get('/', async (req, res) => {
  try {
    // Check session status
    const status = getStatus();
    if (status.state !== 'READY') {
      return res.status(409).json({
        error: true,
        code: 'SESSION_NOT_READY',
        message: `WhatsApp session not ready. Current state: ${status.state}`
      });
    }

    const accountInfo = await getAccountInfo();
    res.status(200).json(accountInfo);

  } catch (error) {
    console.error('[Route:Account] Error:', error);
    res.status(500).json({
      error: true,
      code: 'INTERNAL_ERROR',
      message: error.message || 'Failed to get account info'
    });
  }
});

export default router;
