import apiService from './api';

export const campanasService = {
  // Obtener todas las campañas
  async obtenerCampanas() {
    try {
      const response = await apiService.get('/sender/campaigns');
      return response.data;
    } catch (error) {
      console.error('Error al obtener campañas:', error);
      throw error;
    }
  },

  // Obtener campaña por ID
  async obtenerCampana(id) {
    try {
      const response = await apiService.get(`/sender/campaigns/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error al obtener campaña:', error);
      throw error;
    }
  },

  // Crear nueva campaña
  async crearCampana(datos) {
    try {
      const response = await apiService.post('/sender/campaigns', datos);
      return response.data;
    } catch (error) {
      console.error('Error al crear campaña:', error);
      throw error;
    }
  },

  // Actualizar campaña
  async actualizarCampana(id, datos) {
    try {
      const response = await apiService.put(`/sender/campaigns/${id}`, datos);
      return response.data;
    } catch (error) {
      console.error('Error al actualizar campaña:', error);
      throw error;
    }
  },

  // Eliminar campaña
  async eliminarCampana(id) {
    try {
      const response = await apiService.delete(`/sender/campaigns/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error al eliminar campaña:', error);
      throw error;
    }
  },

  // Aprobar campaña (solo admin)
  async aprobarCampana(id, comentario = null) {
    try {
      const response = await apiService.post(`/sender/campaigns/${id}/approve`, { comentario });
      return response.data;
    } catch (error) {
      console.error('Error al aprobar campaña:', error);
      throw error;
    }
  }
};

export default campanasService;