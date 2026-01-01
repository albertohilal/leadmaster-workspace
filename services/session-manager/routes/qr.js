import express from 'express';
import { getQRCode } from '../whatsapp/client.js';

const router = express.Router();

/**
 * GET /qr-code
 * Returns the QR code for WhatsApp authentication
 */
router.get('/', (req, res) => {
  try {
    const qrCode = getQRCode();
    
    if (!qrCode) {
      return res.status(404).json({
        error: true,
        code: 'QR_NOT_AVAILABLE',
        message: 'QR code not available. Session may already be authenticated or not initialized.'
      });
    }

    res.status(200).json({
      qr_code: qrCode
    });
  } catch (error) {
    console.error('[Route:QR] Error:', error);
    res.status(500).json({
      error: true,
      code: 'INTERNAL_ERROR',
      message: 'Failed to get QR code'
    });
  }
});

export default router;
