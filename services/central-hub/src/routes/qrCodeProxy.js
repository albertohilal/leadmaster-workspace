/**
 * QR Code Proxy - Read-Only
 * 
 * Proxy limpio hacia el Session Manager
 * NO valida autorización
 * NO consulta base de datos
 * NO genera QR
 * SOLO reenvía la request
 */

const express = require('express');
const router = express.Router();
const { sessionManagerClient } = require('../integrations/sessionManager');

/**
 * GET /qr-code
 * Proxy read-only al QR generado por session-manager
 * 
 * Header requerido: X-Cliente-Id
 * 
 * Respuestas:
 * - 200: QR disponible
 * - 400: Header X-Cliente-Id faltante o inválido
 * - 404: QR no generado todavía
 * - 409: Sesión no requiere QR
 * - 502: Session Manager no disponible
 * - 500: Error interno
 */
router.get('/', async (req, res) => {
  const clienteIdHeader = req.headers['x-cliente-id'];
  
  // Validación de header
  if (!clienteIdHeader) {
    return res.status(400).json({
      ok: false,
      error: 'MISSING_HEADER',
      message: 'Header X-Cliente-Id es requerido'
    });
  }
  
  const clienteId = parseInt(clienteIdHeader, 10);
  if (isNaN(clienteId) || clienteId <= 0) {
    return res.status(400).json({
      ok: false,
      error: 'INVALID_CLIENT_ID',
      message: 'X-Cliente-Id debe ser un número positivo'
    });
  }
  
  try {
    // Proxy directo al session-manager (sin validación de autorización)
    const qrData = await sessionManagerClient.getQRCode(clienteId);
    
    res.json({
      qr: qrData.qr
    });
    
  } catch (error) {
    console.error(
      `[qr-code-proxy] Error obteniendo QR para cliente ${clienteId}:`,
      error.message
    );
    
    // Mapeo de errores del session-manager
    
    // Error 409: Sesión no requiere QR
    if (error.statusCode === 409) {
      return res.status(409).json({
        ok: false,
        error: 'QR_NOT_REQUIRED',
        message: 'La sesión no requiere QR en este momento',
        current_state: error.response?.current_state
      });
    }
    
    // Error 404: QR no generado todavía
    if (error.statusCode === 404) {
      return res.status(404).json({
        ok: false,
        error: 'QR_NOT_AVAILABLE',
        message: 'QR no disponible. Intenta de nuevo en unos segundos.'
      });
    }
    
    // Error 400: Header inválido (ya validado aquí, pero por si acaso)
    if (error.statusCode === 400) {
      return res.status(400).json({
        ok: false,
        error: 'INVALID_REQUEST',
        message: error.message
      });
    }
    
    // Errores de conexión con session-manager
    if (
      error.message?.includes('UNREACHABLE') ||
      error.message?.includes('ECONNREFUSED') ||
      error.message?.includes('TIMEOUT')
    ) {
      return res.status(502).json({
        ok: false,
        error: 'SESSION_MANAGER_UNAVAILABLE',
        message: 'Session Manager no está disponible'
      });
    }
    
    // Otros errores
    res.status(500).json({
      ok: false,
      error: 'INTERNAL_ERROR',
      message: error.message || 'Error interno del servidor'
    });
  }
});

module.exports = router;
