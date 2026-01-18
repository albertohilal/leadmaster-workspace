/**
 * WhatsApp QR Proxy Routes (Single-Admin)
 *
 * Proxy simplificado para compatibilidad con frontend legacy.
 * Todos los clientes comparten la misma sesión WhatsApp global.
 * 
 * ❗ Regla:
 * - NO lógica de sesión por cliente
 * - NO headers X-Cliente-Id
 * - NO autorizaciones multi-tenant
 */

const express = require('express');
const router = express.Router();
const sessionManagerClient = require('../integrations/sessionManager/sessionManagerClient');
const {
  SessionManagerSessionNotReadyError,
  SessionManagerTimeoutError,
  SessionManagerUnreachableError,
  SessionManagerValidationError
} = require('../integrations/sessionManager/errors');

/**
 * GET /:clienteId/status
 * Devuelve el estado global de WhatsApp (ignora clienteId)
 */
router.get('/:clienteId/status', async (req, res) => {
  try {
    const status = await sessionManagerClient.getStatus();
    
    res.json({
      ok: true,
      cliente_id: parseInt(req.params.clienteId, 10),
      status: status.status,
      connected: status.connected,
      needs_qr: status.status === 'QR_REQUIRED',
      can_send_messages: status.status === 'READY',
      account: status.account
    });
  } catch (error) {
    console.error('[WhatsAppProxy] Error obteniendo estado:', error);

    if (error instanceof SessionManagerTimeoutError) {
      return res.status(504).json({
        ok: false,
        error: 'SESSION_MANAGER_TIMEOUT',
        message: 'Timeout al conectar con Session Manager'
      });
    }

    if (error instanceof SessionManagerUnreachableError) {
      return res.status(503).json({
        ok: false,
        error: 'WHATSAPP_UNAVAILABLE',
        message: 'Session Manager no disponible'
      });
    }

    res.status(500).json({
      ok: false,
      error: 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

/**
 * GET /:clienteId/qr
 * Devuelve el QR global si está disponible (ignora clienteId)
 */
router.get('/:clienteId/qr', async (req, res) => {
  try {
    const qrData = await sessionManagerClient.getQrCode();
    
    res.json({
      ok: true,
      qr_code_base64: qrData.qrDataUrl
    });
  } catch (error) {
    console.error('[WhatsAppProxy] Error obteniendo QR:', error);

    if (error instanceof SessionManagerValidationError) {
      return res.status(404).json({
        ok: false,
        error: 'QR_NOT_AVAILABLE',
        message: error.message
      });
    }

    if (error instanceof SessionManagerTimeoutError) {
      return res.status(504).json({
        ok: false,
        error: 'SESSION_MANAGER_TIMEOUT',
        message: 'Timeout al conectar con Session Manager'
      });
    }

    if (error instanceof SessionManagerUnreachableError) {
      return res.status(503).json({
        ok: false,
        error: 'WHATSAPP_UNAVAILABLE',
        message: 'Session Manager no disponible'
      });
    }

    res.status(404).json({
      ok: false,
      error: 'QR_NOT_AVAILABLE',
      message: 'QR no disponible en este momento'
    });
  }
});

module.exports = router;

