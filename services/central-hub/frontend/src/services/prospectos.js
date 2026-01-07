import apiService from './api';

export const prospectosService = {
  // Obtener prospectos filtrados
  async filtrarProspectos(filtros = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      if (filtros.area) queryParams.append('area', filtros.area);
      if (filtros.rubro) queryParams.append('rubro', filtros.rubro);
      if (filtros.direccion) queryParams.append('direccion', filtros.direccion);
      if (filtros.estado) queryParams.append('estado', filtros.estado);
      if (filtros.tipo_cliente) queryParams.append('tipoCliente', filtros.tipo_cliente);
      if (filtros.limite) queryParams.append('limite', filtros.limite);
      
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
  async obtenerEstados() {
    try {
      const response = await apiService.get('/sender/prospectos/estados');
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