import axios from 'axios';
import { API_BASE_URL } from '../config/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 10000
});

// Interceptor para agregar token JWT a todas las peticiones
api.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// Interceptor para manejo de errores global
api.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', error);
    // Si es 401, redirigir a login
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ===== SESSION MANAGER API =====
/**
 * API alineada con whatsappQrProxy.js (backend real)
 * Endpoints: /api/whatsapp/:clienteId/status y /api/whatsapp/:clienteId/qr
 * 
 * IMPORTANTE:
 * - response.data.session contiene el objeto sesión completo
 * - response.data.qr_string contiene la imagen QR (no qr_code)
 */
export const sessionAPI = {
  /**
   * Obtiene el estado actual de la sesión WhatsApp
   * GET /api/whatsapp/:clienteId/status
   * @param {number|string} clienteId - ID del cliente
   * @returns {Promise} { ok, session: { status, qr_status, qr_code?, phone_number?, ... } }
   */
  getSession: (clienteId) => api.get(`/api/whatsapp/${clienteId}/status`),
  
  /**
   * Solicita generación de código QR
   * GET /api/whatsapp/:clienteId/qr
   * @param {number|string} clienteId - ID del cliente
   * @returns {Promise} { ok, qr_string, qr_expires_at, status }
   * @throws {409} Si la sesión ya está conectada
   * @throws {403} Si el cliente no está autorizado
   * @throws {500} Si falla la generación del QR
   */
  requestQR: (clienteId) => api.get(`/api/whatsapp/${clienteId}/qr`),
  
  // Admin endpoints (mantener si existen en backend)
  listSessions: async () => (await api.get('/session-manager/sessions')).data,
  adminLogin: async (clienteId) => (await api.post('/session-manager/admin/login', { cliente_id: clienteId })).data,
  adminLogout: async (clienteId) => (await api.post('/session-manager/admin/logout', { cliente_id: clienteId })).data,
};

// ===== LISTENER API =====
export const listenerAPI = {
  getStatus: () => api.get('/listener/status'),
  setMode: (mode) => api.post('/listener/mode', { mode }),
  getLogs: (params) => api.get('/listener/logs', { params }),
  enableIA: (telefono) => api.post('/listener/ia/enable', { telefono }),
  disableIA: (telefono) => api.post('/listener/ia/disable', { telefono }),
  getIAStatus: (telefono) => api.get(`/listener/ia/status/${telefono}`),
  testMessage: (data) => api.post('/listener/test-message', data),
};

// ===== SENDER API =====
export const senderAPI = {
  sendMessage: (data) => api.post('/sender/messages/send', data),
  sendBulk: (data) => api.post('/sender/messages/bulk', data),
  getMessageStatus: (id) => api.get(`/sender/messages/status/${id}`),
  
  // Programaciones
  listProgramaciones: (params) => api.get('/sender/programaciones', { params }),
  createProgramacion: (data) => api.post('/sender/programaciones', data),
  updateProgramacion: (id, data) => api.put(`/sender/programaciones/${id}`, data),
  deleteProgramacion: (id) => api.delete(`/sender/programaciones/${id}`),
  
  // Campañas - CRUD completo con validaciones de seguridad
  getCampaigns: () => api.get('/sender/campaigns'),
  getCampaign: (id) => api.get(`/sender/campaigns/${id}`),
  createCampaign: (data) => api.post('/sender/campaigns', data),
  /**
   * Actualizar campaña existente
   * @param {string|number} id - ID de la campaña
   * @param {Object} data - Datos para actualizar (nombre, descripcion, mensaje, programada, fecha_envio)
   * @returns {Promise} Respuesta de la API
   * @throws {Error} Si la campaña no se puede editar (ya enviada, estado no válido)
   */
  updateCampaign: (id, data) => api.put(`/sender/campaigns/${id}`, data),
  deleteCampaign: (id) => api.delete(`/sender/campaigns/${id}`),
  getCampaignStats: (id) => api.get(`/sender/campaigns/${id}/stats`),
  
  // Envíos (solo admin)
  sendCampaign: (id) => api.post(`/sender/campaigns/${id}/send`),
  pauseCampaign: (id) => api.post(`/sender/campaigns/${id}/pause`),
  resumeCampaign: (id) => api.post(`/sender/campaigns/${id}/resume`),
};

// ===== LEADS API - MULTI-CLIENT =====
export const leadsAPI = {
  // Obtener todos los leads del cliente autenticado
  getAll: (params) => api.get('/sender/lugares', { params }),
  // Obtener leads filtrados por tipo, origen, búsqueda
  getFiltered: (filters) => api.get('/sender/lugares/filter', { params: filters }),
  // Obtener estadísticas de leads por tipo
  getStats: () => api.get('/sender/lugares/stats'),
  
  // Prospectos - funcionalidad migrada de whatsapp-massive-sender-V2
  getProspectos: (filters) => api.get('/sender/prospectos/filtrar', { params: filters }),
  getAreas: () => api.get('/sender/prospectos/areas'),
  getRubros: () => api.get('/sender/prospectos/rubros'),
  getProspectosStats: (campaniaId) => api.get('/sender/prospectos/estadisticas', { 
    params: { campania_id: campaniaId } 
  }),
  
  // Endpoints adicionales mantenidos para compatibilidad
  getById: (id) => api.get(`/leads/${id}`),
  search: (query) => api.get('/leads/search', { params: { q: query } }),
  create: (data) => api.post('/leads', data),
  update: (id, data) => api.put(`/leads/${id}`, data),
  delete: (id) => api.delete(`/leads/${id}`),
  getConversations: (id) => api.get(`/leads/${id}/conversations`),
};

// ===== STATS API (agregado para dashboard) =====
export const statsAPI = {
  getDashboard: () => api.get('/stats/dashboard'),
  getSystemHealth: () => api.get('/stats/health'),
};

// ===== AUTH API =====
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (data) => api.post('/auth/register', data),
  logout: () => api.post('/auth/logout'),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (data) => api.put('/auth/profile', data),
};

export default api;
