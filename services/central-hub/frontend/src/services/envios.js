/**
 * Servicio para gestión de envíos (WhatsApp) + clasificación post-envío.
 *
 * - Flujo manual en 2 fases: prepare → confirm
 * - OPS-POST-ENVIO-01: clasificación post-envío auditable
 */

import apiService from './api';

function assertEnvioId(envioId) {
  const n = Number(envioId);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`envioId inválido: ${envioId}`);
  }
  return n;
}

const enviosService = {
  /**
   * Preparar envío manual:
   * Obtiene los datos necesarios antes de abrir WhatsApp.
   *
   * GET /sender/envios/:envioId/manual/prepare
   *
   * @param {number|string} envioId
   * @returns {Promise<Object>} { success, data: { envio_id, telefono, mensaje_final, ... } }
   */
  async prepareManual(envioId) {
    const id = assertEnvioId(envioId);
    try {
      const response = await apiService.get(`/sender/envios/${id}/manual/prepare`);
      return response.data;
    } catch (error) {
      console.error('Error al preparar envío manual:', error);
      throw error;
    }
  },

  /**
   * Confirmar envío manual:
   * Marca el envío como 'enviado' después de confirmación del operador.
   *
   * POST /sender/envios/:envioId/manual/confirm
   *
   * @param {number|string} envioId
   * @returns {Promise<Object>} { success, data, message }
   */
  async confirmManual(envioId) {
    const id = assertEnvioId(envioId);
    try {
      const response = await apiService.post(`/sender/envios/${id}/manual/confirm`);
      return response.data;
    } catch (error) {
      console.error('Error al confirmar envío manual:', error);
      throw error;
    }
  },

  /**
   * Marcar envío manual con error:
   * Marca el envío como 'error' cuando el operador detecta un inconveniente.
   *
   * POST /sender/envios/:envioId/manual/error
   *
   * @param {number|string} envioId
   * @returns {Promise<Object>} { success, data, message }
   */
  async markManualError(envioId) {
    const id = assertEnvioId(envioId);
    try {
      const response = await apiService.post(`/sender/envios/${id}/manual/error`);
      return response.data;
    } catch (error) {
      console.error('Error al marcar envío manual con error:', error);
      throw error;
    }
  },

  /**
   * OPS-POST-ENVIO-01: Registrar clasificación post-envío (auditable).
   *
   * POST /sender/envios/:envioId/post-envio-clasificar
   *
   * @param {number|string} envioId
   * @param {Object} payload { post_envio_estado, accion_siguiente, detalle? }
   * @param {Object} [options]
   * @param {boolean} [options.historial=false] si true, solicita historial completo (?historial=true)
   * @returns {Promise<Object>} { success, data: {...}, historial?: [...] }
   */
  async clasificarPostEnvio(envioId, payload, options = {}) {
    const id = assertEnvioId(envioId);
    try {
      const qs = options.historial ? '?historial=true' : '';
      const response = await apiService.post(
        `/sender/envios/${id}/post-envio-clasificar${qs}`,
        payload
      );
      return response.data;
    } catch (error) {
      console.error('Error al clasificar post-envío:', error);
      throw error;
    }
  }
};

export default enviosService;