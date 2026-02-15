/**
 * Servicio para gestión de envíos manuales de WhatsApp
 * Implementa flujo de 2 fases: prepare → confirm
 */

import apiService from './api';

export const enviosService = {
  /**
   * TAREA 2: Preparar envío manual
   * Obtiene los datos necesarios antes de abrir WhatsApp
   * 
   * @param {number} envioId - ID del envío en ll_envios_whatsapp
   * @returns {Promise<Object>} Datos del envío (telefono, mensaje personalizado, etc.)
   */
  async prepareManual(envioId) {
    try {
      const response = await apiService.get(`/sender/envios/${envioId}/manual/prepare`);
      return response.data;
    } catch (error) {
      console.error('Error al preparar envío manual:', error);
      throw error;
    }
  },

  /**
   * TAREA 3: Confirmar envío manual
   * Marca el envío como 'enviado' después de confirmación del operador
   * 
   * @param {number} envioId - ID del envío en ll_envios_whatsapp
   * @returns {Promise<Object>} Confirmación del cambio de estado
   */
  async confirmManual(envioId) {
    try {
      const response = await apiService.post(`/sender/envios/${envioId}/manual/confirm`);
      return response.data;
    } catch (error) {
      console.error('Error al confirmar envío manual:', error);
      throw error;
    }
  }
};

export default enviosService;
