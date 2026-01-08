import express from 'express';
import QRCode from 'qrcode';
import { getStatus, isReady, needsAuthentication, isRecoverable, getLastQR } from '../whatsapp/client.js';
import { ensureClientInitialized } from '../whatsapp/manager.js';

const router = express.Router();

/**
 * GET /status
 * Header requerido: X-Cliente-Id
 * Returns WhatsApp session status with actionable information
 * Includes QR code in base64 if state is QR_REQUIRED
 */
router.get('/', async (req, res) => {
  const clienteIdHeader = req.headers['x-cliente-id'];
  
  // Validación de header
  if (!clienteIdHeader) {
    return res.status(400).json({
      error: true,
      code: 'MISSING_HEADER',
      message: 'Header X-Cliente-Id es requerido'
    });
  }
  
  const clienteId = parseInt(clienteIdHeader, 10);
  if (isNaN(clienteId) || clienteId <= 0) {
    return res.status(400).json({
      error: true,
      code: 'INVALID_HEADER',
      message: 'X-Cliente-Id debe ser un número positivo'
    });
  }
  
  // Asegurar que el cliente esté inicializado
  ensureClientInitialized(clienteId);
  
  try {
    const status = getStatus(clienteId);
    const qrString = getLastQR(clienteId);
    
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
      can_send_messages: isReady(clienteId),
      needs_qr: needsAuthentication(clienteId),
      is_recoverable: isRecoverable(clienteId),
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
