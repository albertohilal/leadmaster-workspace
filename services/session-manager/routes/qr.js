/**
 * QR Endpoint - Expone QR para escaneo remoto
 * NO genera QR nuevo - solo expone el existente en memoria
 */
import express from 'express';
import QRCode from 'qrcode';
import { getStatus, getLastQR } from '../whatsapp/client.js';

const router = express.Router();

/**
 * GET /qr
 * Returns QR code as base64 PNG if available
 * 
 * Responses:
 * - 200: QR available (state=QR_REQUIRED)
 * - 409: QR not available (other states)
 */
router.get('/', async (req, res) => {
  try {
    const status = getStatus();
    const qrString = getLastQR();
    
    // Caso 1: Estado QR_REQUIRED y QR disponible
    if (status.state === 'QR_REQUIRED' && qrString) {
      // Convertir QR string a PNG base64
      const qrDataURL = await QRCode.toDataURL(qrString, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        width: 300,
        margin: 2
      });
      
      return res.status(200).json({
        state: status.state,
        expires_in: 60, // Informativo - WhatsApp expira QR en ~60s
        qr: qrDataURL
      });
    }
    
    // Caso 2: QR no disponible (cualquier otro estado)
    return res.status(409).json({
      error: 'QR not available',
      state: status.state,
      can_send_messages: status.state === 'READY'
    });
    
  } catch (error) {
    console.error('[QR] Error generating QR image:', error);
    res.status(500).json({
      error: 'Internal error',
      message: error.message
    });
  }
});

export default router;
