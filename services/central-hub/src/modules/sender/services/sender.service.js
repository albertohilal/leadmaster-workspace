/**
 * Service para envío de mensajes de WhatsApp
 * Integración con session-manager vía HTTP
 */

const { sessionManagerClient } = require('../../../integrations/sessionManager');

/**
 * Envía un mensaje de WhatsApp a través del session-manager
 * @param {Object} params - Parámetros del mensaje
 * @param {number} params.clienteId - ID del cliente autenticado
 * @param {string} params.to - Número de teléfono destino
 * @param {string} params.message - Contenido del mensaje
 * @returns {Promise<Object>} Respuesta del session-manager
 * @throws Propaga errores tipados del sessionManagerClient
 */
async function sendMessage({ clienteId, to, message }) {
  return await sessionManagerClient.sendMessage({ clienteId, to, message });
}

module.exports = {
  sendMessage
};
