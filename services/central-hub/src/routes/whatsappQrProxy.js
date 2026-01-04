/**
 * WhatsApp QR Proxy Routes
 * 
 * Expone el estado y QR de WhatsApp del Session Manager externo (puerto 3001)
 * a través del Central Hub (puerto 3012).
 * 
 * ARQUITECTURA:
 * - Este archivo solo define rutas públicas
 * - Toda comunicación con Session Manager pasa por sessionManagerClient.js
 * - NO usa axios directo
 * - NO duplica lógica HTTP
 * - Solo actúa como proxy transparente
 * 
 * Endpoints públicos:
 * - GET /api/whatsapp/:clienteId/status → Devuelve estado WhatsApp
 * - GET /api/whatsapp/:clienteId/qr     → Devuelve QR como JSON
 */

const express = require('express');
const sessionManagerClient = require('../services/sessionManagerClient');
const qrAuthService = require('../services/qrAuthorizationService');

const router = express.Router();

/**
 * GET /api/whatsapp/:clienteId/status
 * Obtiene el estado de la sesión WhatsApp para un cliente
 * 
 * Respuestas:
 * - 200: Estado exitoso desde Session Manager
 * - 502: Session Manager no disponible
 * - 504: Timeout
 */
router.get('/:clienteId/status', async (req, res) => {
  const { clienteId } = req.params;
  
  const clienteIdNum = parseInt(clienteId, 10);
  if (isNaN(clienteIdNum) || clienteIdNum <= 0) {
    return res.status(400).json({
      ok: false,
      error: 'INVALID_CLIENT_ID',
      message: 'clienteId debe ser un número positivo'
    });
  }

  try {
    const status = await sessionManagerClient.getStatus(clienteIdNum);
    res.json(status);
    
  } catch (error) {
    console.error(
      `[whatsapp-proxy] Error obteniendo status para cliente ${clienteId}:`,
      error.message
    );
    
    if (error.message.includes('TIMEOUT')) {
      return res.status(504).json({
        ok: false,
        error: 'GATEWAY_TIMEOUT',
        message: 'Session Manager no respondió a tiempo'
      });
    }
    
    if (
      error.message.includes('UNREACHABLE') ||
      error.message.includes('ECONNREFUSED')
    ) {
      return res.status(502).json({
        ok: false,
        error: 'SESSION_MANAGER_UNAVAILABLE',
        message: 'Session Manager no está disponible'
      });
    }
    
    res.status(502).json({
      ok: false,
      error: 'SESSION_MANAGER_ERROR',
      message: error.message
    });
  }
});

/**
 * GET /api/whatsapp/:clienteId/qr
 * Obtiene el código QR de WhatsApp para un cliente
 * 
 * Respuestas:
 * - 200: QR disponible
 * - 403: Cliente no autorizado
 * - 404 / 409: Propagado desde Session Manager
 * - 500: Error de base de datos
 * - 502: Session Manager no disponible
 * - 504: Timeout
 */
router.get('/:clienteId/qr', async (req, res) => {
  const { clienteId } = req.params;
  
  const clienteIdNum = parseInt(clienteId, 10);
  if (isNaN(clienteIdNum) || clienteIdNum <= 0) {
    return res.status(400).json({
      ok: false,
      error: 'INVALID_CLIENT_ID',
      message: 'clienteId debe ser un número positivo'
    });
  }

  try {
    // FASE 2: Verificar autorización ANTES de proxy
    const authorized = await qrAuthService.isAuthorized(clienteIdNum);
    
    if (!authorized) {
      return res.status(403).json({
        error: 'QR_NOT_AUTHORIZED',
        message: 'QR no autorizado para este cliente'
      });
    }
    
    const qrData = await sessionManagerClient.getQR(clienteIdNum);
    res.json(qrData);
    
  } catch (error) {
    console.error(
      `[whatsapp-proxy] Error obteniendo QR para cliente ${clienteId}:`,
      error.message
    );
    
    // 🔒 Error real de base de datos (hardening)
    if (
      error.code === 'ER_ACCESS_DENIED_ERROR' ||
      error.code === 'ER_BAD_DB_ERROR' ||
      error.code === 'ECONNREFUSED'
    ) {
      return res.status(500).json({
        ok: false,
        error: 'DATABASE_ERROR',
        message: 'Error verificando autorización'
      });
    }
    
    // Errores explícitos del Session Manager
    if (error.statusCode) {
      return res.status(error.statusCode).json(
        error.response || {
          ok: false,
          error: error.code || 'SESSION_MANAGER_ERROR',
          message: error.message
        }
      );
    }
    
    if (error.message.includes('TIMEOUT')) {
      return res.status(504).json({
        ok: false,
        error: 'GATEWAY_TIMEOUT',
        message: 'Session Manager no respondió a tiempo'
      });
    }
    
    if (
      error.message.includes('UNREACHABLE') ||
      error.message.includes('ECONNREFUSED')
    ) {
      return res.status(502).json({
        ok: false,
        error: 'SESSION_MANAGER_UNAVAILABLE',
        message: 'Session Manager no está disponible'
      });
    }
    
    res.status(500).json({
      ok: false,
      error: 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

module.exports = router;
