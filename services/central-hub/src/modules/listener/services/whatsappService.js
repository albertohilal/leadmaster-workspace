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

async function isWhatsappSessionActive(cliente_id) {
  // Verifica si la sesión de WhatsApp está activa y lista
  const state = sessionService.getSessionState();
  return state.ready;
}

async function enviarWhatsapp(cliente_id, telefono, mensaje) {
  try {
    // Verifica que la sesión esté lista antes de enviar
    if (!sessionService.isReady()) {
      const state = sessionService.getSessionState();
      console.warn(`⚠️ [whatsapp] Sesión no lista. Estado: ${state.state}`);
      
      if (state.state === 'qr') {
        console.log('📱 [whatsapp] Accede a /session-manager/qr para escanear el código QR');
      }
      
      return false;
    }

    await sessionService.sendMessage(telefono, mensaje);
    console.log(`✅ [whatsapp] Mensaje enviado a ${telefono} para cliente ${cliente_id}`);
    return true;
  } catch (error) {
    console.error(`❌ [whatsapp] Error enviando mensaje:`, error.message);
    return false;
  }
}

module.exports = { isWhatsappSessionActive, enviarWhatsapp };
