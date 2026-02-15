import apiService from './api';

export const destinatariosService = {
  // Obtener destinatarios completos de una campaña
  async getDestinatariosCampania(campaniaId) {
    try {
      const response = await apiService.get(`/sender/destinatarios/campania/${campaniaId}`);
      return response.data;
    } catch (error) {
      console.error('Error al obtener destinatarios de campaña:', error);
      throw error;
    }
  },

  // Obtener solo resumen de destinatarios de una campaña
  async getResumenDestinatarios(campaniaId) {
    try {
      const response = await apiService.get(`/sender/destinatarios/campania/${campaniaId}/resumen`);
      return response.data;
    } catch (error) {
      console.error('Error al obtener resumen de destinatarios:', error);
      throw error;
    }
  },

  // Agregar destinatarios a una campaña
  async agregarDestinatarios(campaniaId, destinatarios) {
    try {
      const response = await apiService.post(`/sender/destinatarios/campania/${campaniaId}/agregar`, {
        destinatarios
      });
      return response.data;
    } catch (error) {
      console.error('Error al agregar destinatarios:', error);
      throw error;
    }
  },

  // Quitar destinatarios de una campaña
  async quitarDestinatarios(campaniaId, telefonos) {
    try {
      const response = await apiService.delete(`/sender/destinatarios/campania/${campaniaId}/quitar`, {
        data: { telefonos }
      });
      return response.data;
    } catch (error) {
      console.error('Error al quitar destinatarios:', error);
      throw error;
    }
  },

  // ❌ FUNCIÓN ELIMINADA - Endpoint deprecado
  // Reemplazado por /manual/prepare y /manual/confirm
};

export default destinatariosService;