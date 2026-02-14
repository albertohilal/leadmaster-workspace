/**
 * QR Code Read-Only Endpoint
 * 
 * Retorna el código QR ya generado por whatsapp-web.js
 * NO genera QR - solo lectura
 * Solo válido cuando state === "QR_REQUIRED"
 */

import express from 'express';
import QRCode from 'qrcode';
import { getStatus, getLastQR } from '../whatsapp/client.js';
import { ensureClientInitialized } from '../whatsapp/manager.js';

const router = express.Router();

/**
 * GET /qr-code
 * Header requerido: X-Cliente-Id
 * 
 * Responses:
 * - 200: QR disponible
 * - 400: Header faltante o inválido
 * - 404: QR no generado todavía
 * - 409: Sesión no requiere QR
 * - 500: Error interno
 */
router.get('/', async (req, res) => {
  const clienteIdHeader = req.headers['x-cliente-id'];
  
  // Validación de header
  if (!clienteIdHeader) {
    return res.status(400).json({
      error: 'MISSING_HEADER',
      message: 'Header X-Cliente-Id es requerido'
    });
  }
  
  const clienteId = parseInt(clienteIdHeader, 10);
  if (isNaN(clienteId) || clienteId <= 0) {
    return res.status(400).json({
      error: 'INVALID_HEADER',
      message: 'X-Cliente-Id debe ser un número positivo'
    });
  }
  
  // Asegurar que el cliente esté inicializado
  ensureClientInitialized(clienteId);
  
  try {
    // Obtener estado actual de la sesión
    const status = getStatus(clienteId);
    
    // Validar que el estado requiere QR
    if (status.state !== 'QR_REQUIRED') {
      return res.status(409).json({
        error: 'QR_NOT_REQUIRED',
        message: 'La sesión no requiere QR en este momento',
        current_state: status.state
      });
    }
    
    // Obtener el QR ya generado
    const qrString = getLastQR(clienteId);
    
    if (!qrString) {
      return res.status(404).json({
        error: 'QR_NOT_AVAILABLE',
        message: 'QR no generado todavía. Intenta de nuevo en unos segundos.'
      });
    }
    
    // Convertir el QR string a data URL (base64)
    const qrDataUrl = await QRCode.toDataURL(qrString);
    
    res.json({
      qr: qrDataUrl
    });
    
  } catch (error) {
    console.error('[qr-code] Error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

export default router;
