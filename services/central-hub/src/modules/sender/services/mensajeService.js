/**
 * Servicio para renderizado de mensajes de campaña
 * Garantiza consistencia en la personalización de variables
 * 
 * TAREA 5: Coherencia de mensajes
 */

/**
 * Renderiza un mensaje de campaña reemplazando variables por valores reales
 * 
 * @param {string} mensajeTemplate - Mensaje con variables (ej: "Hola {nombre}")
 * @param {Object} datos - Datos del destinatario
 * @param {string} datos.nombre_destino - Nombre del destinatario
 * @returns {string} Mensaje renderizado
 */
function renderizarMensaje(mensajeTemplate, datos) {
  if (!mensajeTemplate) {
    return '';
  }

  const { nombre_destino = '' } = datos;

  return mensajeTemplate
    .replace(/\{nombre\}/gi, nombre_destino)
    .replace(/\{nombre_destino\}/gi, nombre_destino)
    .trim();
}

/**
 * Valida que un teléfono esté en formato válido
 * 
 * @param {string} telefono - Teléfono a validar
 * @returns {string|null} Teléfono normalizado o null si es inválido
 */
function normalizarTelefono(telefono) {
  if (!telefono) return null;

  // Remover todos los caracteres no numéricos
  const telefonoLimpio = String(telefono).replace(/\D/g, '');

  // Validar que tenga al menos 10 dígitos
  if (telefonoLimpio.length < 10) {
    return null;
  }

  return telefonoLimpio;
}

module.exports = {
  renderizarMensaje,
  normalizarTelefono
};
