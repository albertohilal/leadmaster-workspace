/**
 * QR Authorization Service
 * 
 * Gestiona el ciclo de vida de autorizaciones de códigos QR para sesiones WhatsApp.
 * Parte del módulo canónico whatsappQrAuthorization.
 * 
 * Estados:
 * - PENDING: QR generado, esperando autorización
 * - AUTHORIZED: QR autorizado para uso
 * - REVOKED: Autorización revocada
 */

// Almacenamiento en memoria (temporal - migrar a DB en fase posterior)
const qrSessions = new Map();

/**
 * Registra una nueva sesión de QR
 * @param {Object} params
 * @param {string} params.sessionId - ID único de la sesión
 * @param {string} params.qrHash - Hash del código QR generado
 * @param {number} params.clientId - ID del cliente propietario
 * @returns {Promise<Object>} Datos de la sesión creada
 */
async function registerQrSession({ sessionId, qrHash, clientId }) {
  const now = new Date().toISOString();
  
  const session = {
    sessionId,
    qrHash,
    clientId,
    status: 'PENDING',
    createdAt: now,
    authorizedAt: null,
    authorizedBy: null,
    revokedAt: null,
    revokedBy: null
  };
  
  qrSessions.set(sessionId, session);
  
  return {
    sessionId: session.sessionId,
    status: session.status,
    createdAt: session.createdAt
  };
}

/**
 * Autoriza una sesión de QR existente
 * @param {Object} params
 * @param {string} params.sessionId - ID de la sesión a autorizar
 * @param {string} params.authorizedBy - Usuario/sistema que autoriza
 * @returns {Promise<Object>} Datos de la sesión autorizada
 */
async function authorizeQrSession({ sessionId, authorizedBy }) {
  const session = qrSessions.get(sessionId);
  
  if (!session) {
    return {
      sessionId,
      status: 'NOT_FOUND',
      error: 'Session not found'
    };
  }
  
  if (session.status === 'REVOKED') {
    return {
      sessionId,
      status: 'REVOKED',
      error: 'Session already revoked'
    };
  }
  
  const now = new Date().toISOString();
  session.status = 'AUTHORIZED';
  session.authorizedAt = now;
  session.authorizedBy = authorizedBy;
  
  return {
    sessionId: session.sessionId,
    status: session.status,
    createdAt: session.createdAt,
    authorizedAt: session.authorizedAt
  };
}

/**
 * Revoca una sesión de QR existente
 * @param {Object} params
 * @param {string} params.sessionId - ID de la sesión a revocar
 * @param {string} params.revokedBy - Usuario/sistema que revoca
 * @returns {Promise<Object>} Datos de la sesión revocada
 */
async function revokeQrSession({ sessionId, revokedBy }) {
  const session = qrSessions.get(sessionId);
  
  if (!session) {
    return {
      sessionId,
      status: 'NOT_FOUND',
      error: 'Session not found'
    };
  }
  
  const now = new Date().toISOString();
  session.status = 'REVOKED';
  session.revokedAt = now;
  session.revokedBy = revokedBy;
  
  return {
    sessionId: session.sessionId,
    status: session.status,
    createdAt: session.createdAt,
    revokedAt: session.revokedAt
  };
}

/**
 * Obtiene el estado de una sesión de QR
 * @param {string} sessionId - ID de la sesión
 * @returns {Promise<Object|null>} Datos de la sesión o null si no existe
 */
async function getQrSession(sessionId) {
  const session = qrSessions.get(sessionId);
  
  if (!session) {
    return null;
  }
  
  return {
    sessionId: session.sessionId,
    clientId: session.clientId,
    status: session.status,
    createdAt: session.createdAt,
    authorizedAt: session.authorizedAt,
    revokedAt: session.revokedAt
  };
}

/**
 * Verifica si un cliente está autorizado para generar QR
 * @param {number} clientId - ID del cliente
 * @returns {Promise<boolean>} true si está autorizado
 */
async function isAuthorized(clientId) {
  // TODO: Implementar verificación contra tabla de autorizaciones en DB
  // Por ahora, todos los clientes están autorizados
  return true;
}

module.exports = {
  registerQrSession,
  authorizeQrSession,
  revokeQrSession,
  getQrSession,
  isAuthorized
};
