/**
 * Controller para envío de mensajes de WhatsApp
 * Integración con session-manager
 */

const senderService = require('../services/sender.service');
const {
  SessionManagerValidationError,
  SessionManagerSessionNotReadyError,
  SessionManagerWhatsAppError,
  SessionManagerTimeoutError,
  SessionManagerUnreachableError
} = require('../../../integrations/sessionManager');

/**
 * POST /sender/send
 * Envía un mensaje de WhatsApp individual
 */
async function send(req, res) {
  try {
    // Validar payload
    const { to, message } = req.body;

    if (!to) {
      return res.status(400).json({
        success: false,
        error: 'El campo "to" es requerido'
      });
    }

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'El campo "message" es requerido'
      });
    }

    // Obtener cliente_id del usuario autenticado
    const clienteId = req.user?.cliente_id;

    if (!clienteId) {
      console.error('[Sender] Usuario sin cliente_id:', req.user);
      return res.status(401).json({
        success: false,
        error: 'Usuario no autenticado o sin cliente_id'
      });
    }

    console.log(`[Sender] Enviando mensaje a ${to} para cliente ${clienteId}`);

    // Llamar al service
    const result = await senderService.sendMessage({
      clienteId,
      to,
      message
    });

    // Respuesta exitosa
    return res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    // Mapear errores tipados a códigos HTTP
    if (error instanceof SessionManagerValidationError) {
      console.error('[Sender] Error de validación:', error.message);
      return res.status(400).json({
        success: false,
        error: 'Error de validación',
        details: error.message
      });
    }

    if (error instanceof SessionManagerSessionNotReadyError) {
      console.error('[Sender] Sesión no lista:', error.message);
      return res.status(503).json({
        success: false,
        error: 'Sesión de WhatsApp no está lista',
        details: error.message
      });
    }

    if (error instanceof SessionManagerWhatsAppError) {
      console.error('[Sender] Error de WhatsApp:', error.message);
      return res.status(502).json({
        success: false,
        error: 'Error interno de WhatsApp',
        details: error.message
      });
    }

    if (error instanceof SessionManagerTimeoutError) {
      console.error('[Sender] Timeout:', error.message);
      return res.status(504).json({
        success: false,
        error: 'Timeout al conectar con Session Manager',
        details: error.message
      });
    }

    if (error instanceof SessionManagerUnreachableError) {
      console.error('[Sender] Session Manager no disponible:', error.message);
      return res.status(502).json({
        success: false,
        error: 'Session Manager no disponible',
        details: error.message
      });
    }

    // Error no esperado
    console.error('[Sender] Error inesperado:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    });
  }
}

module.exports = {
  send
};
