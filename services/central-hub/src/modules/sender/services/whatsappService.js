/**
 * @deprecated VIOLATES SESSION_MANAGER_API_CONTRACT
 * 
 * Este archivo usa el módulo legacy session-manager/services/sessionService
 * que viola el contrato oficial.
 * 
 * REEMPLAZO: src/integrations/sessionManager/sessionManagerClient.js
 * 
 * Este archivo NO debe ser usado. Todo código debe migrar a:
 * - sessionManagerClient.getSession()
 * - sessionManagerClient.sendMessage()
 * - SessionStatus enum
 * 
 * ESTADO: Sin referencias activas. Pendiente eliminación.
 */

// DEPRECATED - DO NOT USE
const sessionService = require('../../session-manager/services/sessionService');

/**
 * Verifica si la sesión de WhatsApp está activa
 * @returns {boolean}
 */
function isSessionReady() {
  return sessionService.isReady();
}

/**
 * Obtiene el estado de la sesión
 * @returns {Object} { state, hasQR, ready }
 */
function getSessionState() {
  return sessionService.getSessionState();
}

/**
 * Envía un mensaje por WhatsApp
 * @param {string} phoneNumber - Número de teléfono (con código de país)
 * @param {string} message - Mensaje a enviar
 * @returns {Promise<boolean>} true si se envió correctamente
 */
async function sendMessage(phoneNumber, message) {
  try {
    if (!sessionService.isReady()) {
      const state = sessionService.getSessionState();
      console.warn(`⚠️ [sender] Sesión no lista. Estado: ${state.state}`);
      
      if (state.state === 'qr') {
        console.log('📱 [sender] Accede a /session-manager/qr para escanear el código QR');
      }
      
      return false;
    }

    await sessionService.sendMessage(phoneNumber, message);
    console.log(`✅ [sender] Mensaje enviado a ${phoneNumber}`);
    return true;
  } catch (error) {
    console.error(`❌ [sender] Error enviando mensaje:`, error.message);
    return false;
  }
}

/**
 * Envía mensajes masivos (uno por uno)
 * @param {Array} messages - Array de { phoneNumber, message }
 * @returns {Promise<Object>} { sent, failed, results }
 */
async function sendBulkMessages(messages) {
  const results = [];
  let sent = 0;
  let failed = 0;

  if (!sessionService.isReady()) {
    const state = sessionService.getSessionState();
    return {
      sent: 0,
      failed: messages.length,
      error: `Sesión no lista. Estado: ${state.state}`,
      results: []
    };
  }

  for (const msg of messages) {
    try {
      const success = await sendMessage(msg.phoneNumber, msg.message);
      if (success) {
        sent++;
        results.push({ phoneNumber: msg.phoneNumber, status: 'enviado' });
      } else {
        failed++;
        results.push({ phoneNumber: msg.phoneNumber, status: 'fallido', error: 'No se pudo enviar' });
      }
      
      // Pequeña pausa entre mensajes para evitar spam
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      failed++;
      results.push({ phoneNumber: msg.phoneNumber, status: 'fallido', error: error.message });
    }
  }

  console.log(`📊 [sender] Envío masivo completado: ${sent} enviados, ${failed} fallidos`);
  return { sent, failed, results };
}

module.exports = {
  isSessionReady,
  getSessionState,
  sendMessage,
  sendBulkMessages
};
