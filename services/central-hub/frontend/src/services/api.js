import axios from 'axios';
import { API_BASE_URL } from '../config/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 10000
});

// ===============================
// REQUEST INTERCEPTOR (JWT)
// ===============================
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');

    if (token) {
      if (!('Authorization' in config.headers)) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ===============================
// RESPONSE INTERCEPTOR
// ===============================
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);

    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

// ===============================
// SESSION MANAGER API
// ===============================
export const sessionAPI = {
  getSession: (clienteId) =>
    api.get(`/whatsapp/${clienteId}/status`),

  // QR público SIN JWT
  getQRCode: (clienteId) =>
    api.get(`/whatsapp/${clienteId}/qr`, {
      headers: {
        Authorization: undefined
      }
    }),

  listSessions: async () =>
    (await api.get('/session-manager/sessions')).data,

  adminLogin: async (clienteId) =>
    (await api.post('/session-manager/admin/login', {
      cliente_id: clienteId
    })).data,

  adminLogout: async (clienteId) =>
    (await api.post('/session-manager/admin/logout', {
      cliente_id: clienteId
    })).data
};

// ===============================
// LISTENER API
// ===============================
export const listenerAPI = {
  getStatus: () => api.get('/listener/status'),
  setMode: (mode) => api.post('/listener/mode', { mode }),
  getLogs: (params) => api.get('/listener/logs', { params }),
  enableIA: (telefono) => api.post('/listener/ia/enable', { telefono }),
  disableIA: (telefono) => api.post('/listener/ia/disable', { telefono }),
  getIAStatus: (telefono) =>
    api.get(`/listener/ia/status/${telefono}`),
  testMessage: (data) =>
    api.post('/listener/test-message', data),
};

// ===============================
// SENDER API
// ===============================
export const senderAPI = {
  sendMessage: (data) =>
    api.post('/sender/messages/send', data),

  sendBulk: (data) =>
    api.post('/sender/messages/bulk', data),

  getMessageStatus: (id) =>
    api.get(`/sender/messages/status/${id}`),

  listProgramaciones: (params) =>
    api.get('/sender/programaciones', { params }),

  createProgramacion: (data) =>
    api.post('/sender/programaciones', data),

  updateProgramacion: (id, data) =>
    api.put(`/sender/programaciones/${id}`, data),

  deleteProgramacion: (id) =>
    api.delete(`/sender/programaciones/${id}`),

  getCampaigns: () =>
    api.get('/sender/campaigns'),

  getCampaign: (id) =>
    api.get(`/sender/campaigns/${id}`),

  createCampaign: (data) =>
    api.post('/sender/campaigns', data),

  updateCampaign: (id, data) =>
    api.put(`/sender/campaigns/${id}`, data),

  deleteCampaign: (id) =>
    api.delete(`/sender/campaigns/${id}`),

  getCampaignStats: (id) =>
    api.get(`/sender/campaigns/${id}/stats`),

  sendCampaign: (id) =>
    api.post(`/sender/campaigns/${id}/send`),

  pauseCampaign: (id) =>
    api.post(`/sender/campaigns/${id}/pause`),

  resumeCampaign: (id) =>
    api.post(`/sender/campaigns/${id}/resume`)
};

// ===============================
// LEADS API
// ===============================
export const leadsAPI = {
  getAll: (params) =>
    api.get('/sender/lugares', { params }),

  getFiltered: (filters) =>
    api.get('/sender/lugares/filter', { params: filters }),

  getStats: () =>
    api.get('/sender/lugares/stats'),

  getProspectos: (filters) =>
    api.get('/sender/prospectos/filtrar', { params: filters }),

  getAreas: () =>
    api.get('/sender/prospectos/areas'),

  getRubros: () =>
    api.get('/sender/prospectos/rubros'),

  getProspectosStats: (campaniaId) =>
    api.get('/sender/prospectos/estadisticas', {
      params: { campania_id: campaniaId }
    }),

  getById: (id) =>
    api.get(`/leads/${id}`),

  search: (query) =>
    api.get('/leads/search', {
      params: { q: query }
    }),

  create: (data) =>
    api.post('/leads', data),

  update: (id, data) =>
    api.put(`/leads/${id}`, data),

  delete: (id) =>
    api.delete(`/leads/${id}`),

  getConversations: (id) =>
    api.get(`/leads/${id}/conversations`)
};

// ===============================
// STATS API
// ===============================
export const statsAPI = {
  getDashboard: () =>
    api.get('/stats/dashboard'),

  getSystemHealth: () =>
    api.get('/stats/health')
};

// ===============================
// AUTH API
// ===============================
export const authAPI = {
  login: (credentials) =>
    api.post('/auth/login', credentials),

  register: (data) =>
    api.post('/auth/register', data),

  logout: () =>
    api.post('/auth/logout'),

  getProfile: () =>
    api.get('/auth/profile'),

  updateProfile: (data) =>
    api.put('/auth/profile', data)
};

export default api;
