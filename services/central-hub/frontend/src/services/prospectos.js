import apiService from './api';

export const prospectosService = {
  // Obtener prospectos filtrados
  async filtrarProspectos(filtros = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      // ✅ CRÍTICO: Incluir campania_id (obligatorio)
      if (filtros.campania_id) queryParams.append('campania_id', filtros.campania_id);
      
      // Filtros simplificados
      if (filtros.estado) queryParams.append('estado', filtros.estado);
      if (filtros.q) queryParams.append('q', filtros.q);
      
      const url = `/sender/prospectos/filtrar${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await apiService.get(url);
      return response.data;
    } catch (error) {
      console.error('Error al filtrar prospectos:', error);
      throw error;
    }
  },

  // Obtener áreas disponibles
  async obtenerAreas() {
    try {
      const response = await apiService.get('/sender/prospectos/areas');
      return response.data;
    } catch (error) {
      console.error('Error al obtener áreas:', error);
      throw error;
    }
  },

  // Obtener rubros disponibles
  async obtenerRubros() {
    try {
      const response = await apiService.get('/sender/prospectos/rubros');
      return response.data;
    } catch (error) {
      console.error('Error al obtener rubros:', error);
      throw error;
    }
  },

  // Obtener estados disponibles
  async obtenerEstados(campaniaId = null) {
    try {
      const params = campaniaId ? { campania_id: campaniaId } : {};
      const response = await apiService.get('/sender/prospectos/estados', { params });
      return response.data;
    } catch (error) {
      console.error('Error al obtener estados:', error);
      throw error;
    }
  },

  // Obtener estadísticas de prospectos
  async obtenerEstadisticas() {
    try {
      const response = await apiService.get('/sender/prospectos/estadisticas');
      return response.data;
    } catch (error) {
      console.error('Error al obtener estadísticas:', error);
      throw error;
    }
  }
};

export default prospectosService;