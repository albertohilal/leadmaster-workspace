/**
 * WhatsApp QR Proxy Routes
 * 
 * Router fino que expone endpoints de WhatsApp session management.
 * Delega toda la lógica HTTP al controller del módulo whatsappQrAuthorization.
 * 
 * ARQUITECTURA:
 * - Router: Define rutas y delega (este archivo)
 * - Controller: Lógica HTTP y orquestación
 * - Service: Lógica de negocio
 * 
 * Endpoints públicos:
 * - GET /api/whatsapp/:clienteId/status → Estado de sesión WhatsApp
 * - GET /api/whatsapp/:clienteId/qr     → Genera/devuelve código QR
 */

const express = require('express');
const router = express.Router();

const whatsappQrController = require(
  '../modules/whatsappQrAuthorization/controllers/whatsappQrController'
);

/**
 * GET /api/whatsapp/:clienteId/status
 * Obtiene el estado de la sesión WhatsApp
 */
router.get('/:clienteId/status', whatsappQrController.getWhatsappSessionStatus);

/**
 * GET /api/whatsapp/:clienteId/qr
 * Solicita generación de código QR WhatsApp
 */
router.get('/:clienteId/qr', whatsappQrController.getWhatsappQr);

module.exports = router;
