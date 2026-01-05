/**
 * Service para envío de mensajes de WhatsApp
 * Integración con session-manager vía HTTP
 * 
 * CONTRATO:
 * - Antes de enviar, verifica que session.status === 'connected'
 * - NO asume disponibilidad sin consultar
 * - Propaga errores tipados del contrato
 */

const { 
  sessionManagerClient, 
  SessionStatus,
  SessionNotFoundError,
  SessionManagerSessionNotReadyError
} = require('../../../integrations/sessionManager');

/**
 * Envía un mensaje de WhatsApp a través del session-manager
 * 
 * Flujo según contrato:
 * 1. Obtener estado de la sesión con getSession()
 * 2. Verificar que status === 'connected'
 * 3. Si está conectado, enviar mensaje
 * 4. Si no está conectado, rechazar con error descriptivo
 * 
 * @param {Object} params - Parámetros del mensaje
 * @param {number} params.clienteId - ID del cliente autenticado
 * @param {string} params.to - Número de teléfono destino
 * @param {string} params.message - Contenido del mensaje
 * @returns {Promise<Object>} Respuesta del session-manager
 * @throws {SessionNotFoundError} Si la sesión no existe
 * @throws {SessionManagerSessionNotReadyError} Si la sesión no está conectada
 * @throws Propaga otros errores tipados del sessionManagerClient
 */
async function sendMessage({ clienteId, to, message }) {
  const instanceId = `sender_${clienteId}`;

  // Paso 1: Verificar estado de la sesión ANTES de enviar
  let session;
  try {
    session = await sessionManagerClient.getSession(instanceId);
  } catch (error) {
    if (error instanceof SessionNotFoundError) {
      throw new SessionManagerSessionNotReadyError(
        `No hay sesión de WhatsApp para el cliente ${clienteId}. Debe inicializarse primero.`
      );
    }
    throw error; // Re-lanzar otros errores
  }

  // Paso 2: Validar que la sesión esté conectada (contrato oficial)
  if (session.status !== SessionStatus.CONNECTED) {
    const statusMessages = {
      [SessionStatus.INIT]: 'La sesión está inicializando. Escanea el código QR.',
      [SessionStatus.QR_REQUIRED]: 'Debes escanear el código QR para conectar WhatsApp.',
      [SessionStatus.CONNECTING]: 'La sesión está conectando. Espera unos segundos.',
      [SessionStatus.DISCONNECTED]: 'WhatsApp está desconectado. Reconecta escaneando el QR.',
      [SessionStatus.ERROR]: `Error en la sesión: ${session.last_error_message || 'desconocido'}`
    };

    const message = statusMessages[session.status] || `Estado de sesión: ${session.status}`;
    
    throw new SessionManagerSessionNotReadyError(
      `WhatsApp no está listo para enviar mensajes. ${message}`
    );
  }

  // Paso 3: La sesión está conectada - proceder con el envío
  return await sessionManagerClient.sendMessage({ clienteId, to, message });
}

module.exports = {
  sendMessage
};
