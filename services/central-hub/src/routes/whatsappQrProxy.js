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
  getWhatsappSessionStatus,
  getWhatsappQr
} = require('../modules/whatsappQrAuthorization/controllers/whatsappQrController');

/**
 * GET /:clienteId/status
 * Devuelve el estado actual de la sesión WhatsApp del cliente
 * 
 * Ruta final: /whatsapp/:clienteId/status (montado en index.js con app.use('/whatsapp'))
 * NGINX recibe: /api/whatsapp/51/status
 * NGINX elimina /api → /whatsapp/51/status
 * Express recibe: /whatsapp/51/status y hace match con /whatsapp/:clienteId/status
 */
router.get('/:clienteId/status', getWhatsappSessionStatus);

/**
 * GET /:clienteId/qr
 * Solicita / devuelve el QR de WhatsApp para el cliente
 * 
 * Ruta final: /whatsapp/:clienteId/qr (montado en index.js con app.use('/whatsapp'))
 */
router.get('/:clienteId/qr', getWhatsappQr);

module.exports = router;
