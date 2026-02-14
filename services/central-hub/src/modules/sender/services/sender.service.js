/**
 * Service para envío de mensajes de WhatsApp
 * Integración con Session Manager vía HTTP (contrato REAL)
 *
 * CONTRATO EFECTIVO:
 * - Antes de enviar, consulta /status
 * - Requiere status === 'READY' && connected === true
 * - ABORTA si WhatsApp no está listo
 */

const whatsappService = require('./whatsappService');
const { isWhatsAppReady } = require('../../../services/sessionManagerClient');

const DRY_RUN = process.env.DRY_RUN === 'true';

/**
 * Envía un mensaje de WhatsApp
 *
 * @param {Object} params
 * @param {number|string} params.clienteId
 * @param {string} params.to
 * @param {string} params.message
 */
async function sendMessage({ clienteId, to, message }) {
  if (!clienteId) {
    throw new Error('[SENDER] clienteId requerido');
  }

  // ==================================================
  // 🔒 PRECHECK CRÍTICO — BLOQUEO DURO
  // ==================================================
  const { ready, status } = await isWhatsAppReady(clienteId);

  if (!ready) {
    const statusMessages = {
      INIT: 'La sesión está inicializando.',
      QR_REQUIRED: 'Debe escanear el código QR.',
      CONNECTING: 'WhatsApp está conectando.',
      DISCONNECTED: 'WhatsApp está desconectado.',
      ERROR: 'La sesión de WhatsApp está en error.'
    };

    const humanMessage =
      statusMessages[status.status] ||
      `Estado desconocido (${status.status})`;

    const err = new Error(
      `[SENDER][ABORT] WhatsApp NO READY — ${humanMessage}`
    );

    err.code = 'WHATSAPP_NOT_READY';
    err.sessionStatus = status.status;
    throw err;
  }

  // ==================================================
  // 🧪 DRY RUN — SIMULACIÓN (NO ENVÍA)
  // ==================================================
  if (DRY_RUN) {
    console.log('[DRY-RUN][WHATSAPP]', {
      clienteId,
      to,
      message
    });

    return {
      simulated: true,
      clienteId,
      to,
      message
    };
  }

  // ==================================================
  // 📤 ENVÍO REAL
  // ==================================================
  return await whatsappService.sendMessage({
    clienteId,
    to,
    message
  });
}

module.exports = {
  sendMessage
};
