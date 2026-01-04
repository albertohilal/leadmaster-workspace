// Control de IA por lead (persistente en MySQL)
const pool = require('../db/db');

async function setIAControl(telefono, enabled, motivo = null) {
  if (!telefono) return { success: false, error: 'Teléfono requerido' };
  try {
    // Actualizar con motivo si se desactiva
    if (!enabled && motivo) {
      await pool.execute(
        'INSERT INTO ll_ia_control (telefono, ia_enabled, motivo_desactivacion, fecha_ultima_intervencion, contador_intervenciones) VALUES (?, ?, ?, NOW(), 1) ON DUPLICATE KEY UPDATE ia_enabled = VALUES(ia_enabled), motivo_desactivacion = VALUES(motivo_desactivacion), fecha_ultima_intervencion = NOW(), contador_intervenciones = contador_intervenciones + 1',
        [telefono, enabled, motivo]
      );
    } else {
      await pool.execute(
        'INSERT INTO ll_ia_control (telefono, ia_enabled) VALUES (?, ?) ON DUPLICATE KEY UPDATE ia_enabled = VALUES(ia_enabled)',
        [telefono, enabled]
      );
    }
    return { success: true, telefono, ia_enabled: enabled, motivo };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function isIAEnabled(telefono) {
  if (!telefono) return true;
  try {
    const [rows] = await pool.execute('SELECT ia_enabled FROM ll_ia_control WHERE telefono = ?', [telefono]);
    if (rows.length > 0) return !!rows[0].ia_enabled;
    return true;
  } catch (err) {
    return true; // fallback seguro
  }
}

// Detectar si un mensaje fue enviado por humano y pausar IA automáticamente
async function detectarIntervencionHumana(telefono, mensaje, conversacionId = null) {
  try {
    // 1. Registrar la intervención
    await pool.execute(
      'INSERT INTO ll_intervenciones_humanas (telefono, mensaje_humano, fecha_intervencion, conversacion_id) VALUES (?, ?, NOW(), ?)',
      [telefono, mensaje, conversacionId]
    );
    
    // 2. Marcar en la conversación si hay ID
    if (conversacionId) {
      await pool.execute(
        'UPDATE ll_ia_conversaciones SET origen_mensaje = "humano", pauso_ia = TRUE WHERE id = ?',
        [conversacionId]
      );
    }
    
    // 3. Automáticamente deshabilitar IA para este contacto
    const result = await setIAControl(telefono, false, 'intervencion_humana_detectada');
    
    console.log(`👤 [listener] Intervención humana detectada para ${telefono} - IA pausada automáticamente`);
    logs.push({ 
      timestamp: Date.now(), 
      event: 'human_intervention_detected', 
      telefono, 
      mensaje, 
      conversacionId,
      action: 'ia_disabled_auto' 
    });
    
    return result;
  } catch (err) {
    console.error(`❌ [listener] Error detectando intervención humana:`, err.message);
    return { success: false, error: err.message };
  }
}

// Registrar mensaje en ll_ia_conversaciones con detección automática
async function registrarMensajeConversacion(telefono, rol, mensaje, origenMensaje = 'ia') {
  try {
    const [result] = await pool.execute(
      'INSERT INTO ll_ia_conversaciones (telefono, rol, mensaje, origen_mensaje, pauso_ia, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
      [telefono, rol, mensaje, origenMensaje, origenMensaje === 'humano']
    );
    
    const conversacionId = result.insertId;
    
    // Si es mensaje humano de tipo assistant (respuesta humana), detectar intervención
    if (origenMensaje === 'humano' && rol === 'assistant') {
      await detectarIntervencionHumana(telefono, mensaje, conversacionId);
    }
    
    return { success: true, conversacionId };
  } catch (err) {
    console.error(`❌ [listener] Error registrando mensaje:`, err.message);
    return { success: false, error: err.message };
  }
}

// Reactivar IA para un contacto después de intervención humana
async function reactivarIA(telefono, motivo = 'reactivacion_manual') {
  try {
    const result = await setIAControl(telefono, true);
    
    // Log de reactivación
    await pool.execute(
      'INSERT INTO ll_reactivaciones_ia (telefono, motivo, fecha_reactivacion) VALUES (?, ?, NOW())',
      [telefono, motivo]
    );
    
    console.log(`🤖 [listener] IA reactivada para ${telefono} - Motivo: ${motivo}`);
    logs.push({ 
      timestamp: Date.now(), 
      event: 'ia_reactivated', 
      telefono, 
      motivo 
    });
    
    return result;
  } catch (err) {
    console.error(`❌ [listener] Error reactivando IA:`, err.message);
    return { success: false, error: err.message };
  }
}

// Obtener historial de intervenciones para un contacto
async function obtenerHistorialIntervenciones(telefono) {
  try {
    const [intervenciones] = await pool.execute(
      'SELECT * FROM ll_intervenciones_humanas WHERE telefono = ? ORDER BY fecha_intervencion DESC LIMIT 10',
      [telefono]
    );
    
    const [reactivaciones] = await pool.execute(
      'SELECT * FROM ll_reactivaciones_ia WHERE telefono = ? ORDER BY fecha_reactivacion DESC LIMIT 10',
      [telefono]
    );
    
    return { intervenciones, reactivaciones };
  } catch (err) {
    console.error(`❌ [listener] Error obteniendo historial:`, err.message);
    return { intervenciones: [], reactivaciones: [] };
  }
}
// Servicio principal del listener: gestiona modo y logs
const logs = [];
let mode = process.env.LISTENER_MODE || 'listen';

function getStatus() {
  return { mode };
}

function setMode(newMode) {
  if (['listen', 'respond'].includes(newMode)) {
    mode = newMode;
    return { success: true, mode };
  }
  return { success: false, error: 'Modo inválido' };
}

function getLogs() {
  return logs;
}


// Procesamiento real de mensajes entrantes
const iaService = require('./../ia/iaService');
const { isWhatsappSessionActive, enviarWhatsapp } = require('./whatsappService');

/**
 * Procesa un mensaje entrante y responde si corresponde (IA/reglas)
 * @param {Object} message - { cliente_id, telefono, texto, esHumano, origenMensaje }
 * @returns {Promise<Object>} { respuesta, enviado, error }
 */
async function onMessageReceived(message) {
  logs.push({ timestamp: Date.now(), message });
  
  // Limpiar teléfono (quitar @c.us si existe)
  const telefonoLimpio = message.telefono.replace('@c.us', '');
  
  // Si el mensaje viene marcado como humano, registrar intervención y pausar IA
  if (message.esHumano === true || message.origenMensaje === 'humano') {
    console.log(`👤 [listener] Mensaje humano detectado de ${telefonoLimpio}`);
    
    // Registrar en conversaciones como mensaje humano
    const registro = await registrarMensajeConversacion(
      telefonoLimpio, 
      'assistant', // Los humanos responden como assistant
      message.texto, 
      'humano'
    );
    
    return { 
      respuesta: null, 
      enviado: false, 
      intervencion_humana: true,
      ia_pausada: true,
      conversacion_id: registro.conversacionId,
      mensaje: 'Intervención humana detectada - IA pausada automáticamente para ' + telefonoLimpio
    };
  }
  
  // Registrar mensaje entrante del usuario
  await registrarMensajeConversacion(telefonoLimpio, 'user', message.texto, 'usuario');
  
  if (mode !== 'respond') {
    return { respuesta: null, enviado: false, error: 'Modo no respond' };
  }
  
  const iaEnabled = await isIAEnabled(message.telefono);
  if (!iaEnabled) {
    console.log(`🔇 [listener] IA deshabilitada para ${message.telefono}`);
    return { respuesta: null, enviado: false, error: 'IA deshabilitada para este lead' };
  }

  // Validar sesión de WhatsApp
  const sesionActiva = await isWhatsappSessionActive(message.cliente_id);
  if (!sesionActiva) {
    const sessionService = require('../../session-manager/services/sessionService');
    const state = sessionService.getSessionState();
    const errorMsg = `Sesión de WhatsApp ${state.state}. ${state.state === 'qr' ? 'Escanea el QR en /session-manager/qr' : 'Verifica /session-manager/state'}`;
    
    console.warn(`⚠️ [listener] ${errorMsg}`);
    logs.push({ timestamp: Date.now(), error: errorMsg });
    return { respuesta: null, enviado: false, error: errorMsg };
  }

  // IA/reglas
  const respuesta = await iaService.responder(message);
  let enviado = false;
  let error = null;
  let conversacionIAId = null;
  
  if (respuesta) {
    enviado = await enviarWhatsapp(message.cliente_id, message.telefono, respuesta);
    if (!enviado) {
      error = 'No se pudo enviar el mensaje por WhatsApp';
      console.error(`❌ [listener] ${error}`);
    } else {
      console.log(`✅ [listener] Respuesta IA enviada a ${telefonoLimpio}: "${respuesta}"`);
      
      // Registrar respuesta de IA en conversaciones
      const registro = await registrarMensajeConversacion(
        telefonoLimpio, 
        'assistant', 
        respuesta, 
        'ia'
      );
      conversacionIAId = registro.conversacionId;
    }
  }
  
  logs.push({ timestamp: Date.now(), response: respuesta, enviado, error, conversacionIAId });
  return { respuesta, enviado, error, conversacion_id: conversacionIAId };
}

module.exports = {
  getStatus,
  setMode,
  getLogs,
  onMessageReceived,
  setIAControl,
  isIAEnabled,
  detectarIntervencionHumana,
  reactivarIA,
  obtenerHistorialIntervenciones,
  registrarMensajeConversacion,
};
