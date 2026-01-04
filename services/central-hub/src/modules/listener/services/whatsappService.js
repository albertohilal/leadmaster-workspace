// Integración con el session-manager centralizado para WhatsApp
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
