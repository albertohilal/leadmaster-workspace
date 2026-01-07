import express from 'express';
import QRCode from 'qrcode';
import { getStatus, isReady, needsAuthentication, isRecoverable, getLastQR } from '../whatsapp/client.js';

const router = express.Router();

/**
 * GET /status
 * Returns WhatsApp session status with actionable information
 * Includes QR code in base64 if state is QR_REQUIRED
 */
router.get('/', async (req, res) => {
  try {
    const status = getStatus();
    const qrString = getLastQR();
    
    // Mapa 1:1 de estado a acción recomendada
    const recommendedActionMap = {
      'INITIALIZING': 'Initializing for first time - wait',
      'RECONNECTING': 'Recovering existing session - wait',
      'READY': 'Session operational - can send messages',
      'QR_REQUIRED': 'Scan QR code to authenticate',
      'AUTH_FAILURE': 'Restart service and scan new QR',
      'DISCONNECTED_RECOVERABLE': 'Auto-reconnecting - wait',
      'DISCONNECTED_LOGOUT': 'User logged out - restart and scan QR',
      'DISCONNECTED_BANNED': 'Number banned - contact WhatsApp support',
      'ERROR': 'Technical error - check logs'
    };
    
    // Construir respuesta enriquecida
    const enrichedStatus = {
      ...status,
      can_send_messages: isReady(),
      needs_qr: needsAuthentication(),
      is_recoverable: isRecoverable(),
      recommended_action: recommendedActionMap[status.state] || 'Unknown state'
    };
    
    // Agregar QR en base64 si está disponible y el estado lo requiere
    if (qrString && status.state === 'QR_REQUIRED') {
      try {
        const qrBase64 = await QRCode.toDataURL(qrString);
        enrichedStatus.qr_code_base64 = qrBase64;
      } catch (qrError) {
        console.error('[Status] Error generating QR base64:', qrError);
        enrichedStatus.qr_code_base64 = null;
        enrichedStatus.qr_error = 'Failed to generate QR image';
      }
    } else {
      enrichedStatus.qr_code_base64 = null;
    }
    
    res.status(200).json(enrichedStatus);
  } catch (error) {
    res.status(500).json({
      error: true,
      code: 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

export default router;
