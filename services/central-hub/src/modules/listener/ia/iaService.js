// Servicio principal de IA: orquesta reglas y fallback IA
const { analizarMensaje } = require('./analizador');
const { obtenerRespuesta } = require('./respuestas');
const { obtenerContexto } = require('./contexto');
const { generarRespuesta } = require('./chatgpt');

/**
 * Responde a un mensaje usando reglas o IA
 * @param {Object} params
 * @param {number} params.cliente_id
 * @param {string} params.telefono
 * @param {string} params.texto
 * @returns {Promise<string>} Respuesta lista para enviar
 */
async function responder({ cliente_id, telefono, texto }) {
  // 1. Intentar por reglas
  const clave = analizarMensaje(cliente_id, texto);
  if (clave) {
    const respuesta = obtenerRespuesta(cliente_id, clave);
    if (respuesta) return respuesta;
  }
  // 2. Fallback a IA
  const contexto = obtenerContexto(cliente_id);
  return await generarRespuesta(contexto, texto);
}

module.exports = { responder };
