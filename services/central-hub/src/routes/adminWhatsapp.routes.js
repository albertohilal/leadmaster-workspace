/**
 * Admin WhatsApp Routes
 * 
 * Endpoints administrativos para gestión de WhatsApp single-admin
 * Solo deben ser accesibles por usuarios administradores
 */

const express = require('express');
const router = express.Router();
const sessionManagerClient = require('../integrations/sessionManager/sessionManagerClient');
const {
  SessionManagerSessionNotReadyError,
  SessionManagerTimeoutError,
  SessionManagerUnreachableError
} = require('../integrations/sessionManager/errors');

/**
 * GET /admin/whatsapp/status
 * Obtiene el estado global de WhatsApp
 */
router.get('/status', async (req, res) => {
  try {
    const status = await sessionManagerClient.getStatus();
    res.json(status);
  } catch (error) {
    console.error('[AdminWhatsApp] Error obteniendo estado:', error);

    if (error instanceof SessionManagerTimeoutError) {
      return res.status(504).json({
        error: 'SESSION_MANAGER_TIMEOUT',
        message: 'Timeout al conectar con Session Manager'
      });
    }

    if (error instanceof SessionManagerUnreachableError) {
      return res.status(503).json({
        error: 'WHATSAPP_UNAVAILABLE',
        message: 'Session Manager no disponible'
      });
    }

    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

/**
 * GET /admin/whatsapp/qr
 * Obtiene el código QR si está disponible
 */
router.get('/qr', async (req, res) => {
  try {
    const qrData = await sessionManagerClient.getQrCode();
    res.json(qrData);
  } catch (error) {
    console.error('[AdminWhatsApp] Error obteniendo QR:', error);

    if (error instanceof SessionManagerTimeoutError) {
      return res.status(504).json({
        error: 'SESSION_MANAGER_TIMEOUT',
        message: 'Timeout al conectar con Session Manager'
      });
    }

    if (error instanceof SessionManagerUnreachableError) {
      return res.status(503).json({
        error: 'WHATSAPP_UNAVAILABLE',
        message: 'Session Manager no disponible'
      });
    }

    res.status(404).json({
      error: 'QR_NOT_AVAILABLE',
      message: error.message || 'QR no disponible en este momento'
    });
  }
});

/**
 * POST /admin/whatsapp/connect
 * Inicia la conexión WhatsApp
 */
router.post('/connect', async (req, res) => {
  try {
    const result = await sessionManagerClient.connect();
    res.json(result);
  } catch (error) {
    console.error('[AdminWhatsApp] Error iniciando conexión:', error);

    if (error instanceof SessionManagerTimeoutError) {
      return res.status(504).json({
        error: 'SESSION_MANAGER_TIMEOUT',
        message: 'Timeout al conectar con Session Manager'
      });
    }

    if (error instanceof SessionManagerUnreachableError) {
      return res.status(503).json({
        error: 'WHATSAPP_UNAVAILABLE',
        message: 'Session Manager no disponible'
      });
    }

    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

module.exports = router;
