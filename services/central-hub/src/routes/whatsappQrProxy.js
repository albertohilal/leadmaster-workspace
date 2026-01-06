/**
 * WhatsApp QR Proxy Routes
 *
 * Router fino del Central Hub.
 * Delegación pura hacia los controllers del módulo whatsappQrAuthorization.
 *
 * ❗ Regla:
 * - NO lógica de negocio
 * - NO estado local
 * - NO acceso directo a DB
 */

const express = require('express');
const router = express.Router();

const {
  getWhatsappStatus,
  getWhatsappQr
} = require('../modules/whatsappQrAuthorization/controllers/whatsappQrController');

/**
 * GET /api/whatsapp/:clienteId/status
 * Devuelve el estado actual de la sesión WhatsApp del cliente
 */
router.get('/whatsapp/:clienteId/status', getWhatsappStatus);

/**
 * GET /api/whatsapp/:clienteId/qr
 * Solicita / devuelve el QR de WhatsApp para el cliente
 */
router.get('/whatsapp/:clienteId/qr', getWhatsappQr);

module.exports = router;
