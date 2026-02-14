const axios = require('axios');

const SESSION_MANAGER_BASE_URL =
  process.env.SESSION_MANAGER_BASE_URL || 'http://localhost:3001';

/**
 * Obtiene el estado crudo del Session Manager
 */
async function getSessionStatus(clienteId) {
  if (!clienteId) {
    throw new Error('[SessionManager] clienteId requerido');
  }

  const response = await axios.get(
    `${SESSION_MANAGER_BASE_URL}/status`,
    {
      headers: {
        'X-Cliente-Id': clienteId
      },
      timeout: 5000
    }
  );

  return response.data;
}

/**
 * Devuelve si WhatsApp está listo para enviar mensajes
 */
async function isWhatsAppReady(clienteId) {
  const status = await getSessionStatus(clienteId);

  return {
    ready: status.status === 'READY' && status.connected === true,
    status
  };
}

module.exports = {
  getSessionStatus,
  isWhatsAppReady
};
