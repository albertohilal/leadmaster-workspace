import express from 'express';
import { getStatus, isReady, needsAuthentication, isRecoverable } from '../whatsapp/client.js';

const router = express.Router();

/**
 * GET /status
 * Returns WhatsApp session status with actionable information
 */
router.get('/', (req, res) => {
  try {
    const status = getStatus();
    
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
