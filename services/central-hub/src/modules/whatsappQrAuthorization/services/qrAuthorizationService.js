/**
 * QR Authorization Service
 * 
 * Gestiona el ciclo de vida de autorizaciones de códigos QR para sesiones WhatsApp.
 * Parte del módulo canónico whatsappQrAuthorization.
 * 
 * Lógica de negocio:
 * - Delega persistencia al repository
 * - Mantiene API pública estable
 * - Traduce entre contratos HTTP y queries DB
 * 
 * Persistencia: MySQL (tabla ll_whatsapp_qr_sessions)
 */

const qrAuthorizationRepository = require('../repositories/qrAuthorizationRepository');

/**
 * Autoriza una sesión de QR existente
 * @param {Object} params
 * @param {number} params.clientId - ID del cliente a autorizar
 * @param {number} params.authorizedBy - ID del admin que autoriza
 * @param {Date|null} params.expiresAt - Fecha de expiración opcional
 * @returns {Promise<Object>} Datos de la sesión autorizada
 */
async function authorizeQrSession({ clientId, authorizedBy, expiresAt = null }) {
  try {
    const result = await qrAuthorizationRepository.enableClient({
      clienteId: clientId,
      adminId: authorizedBy,
      expiresAt
    });

    return {
      clientId: result.clienteId,
      status: 'AUTHORIZED',
      enabledAt: result.enabledAt,
      expiresAt: result.expiresAt
    };
  } catch (error) {
    return {
      clientId,
      status: 'ERROR',
      error: error.message
    };
  }
}

/**
 * Revoca una sesión de QR existente
 * @param {Object} params
 * @param {number} params.clientId - ID del cliente a revocar
 * @param {number} params.revokedBy - ID del admin que revoca (opcional)
 * @returns {Promise<Object>} Datos de la sesión revocada
 */
async function revokeQrSession({ clientId, revokedBy = null }) {
  try {
    const result = await qrAuthorizationRepository.revokeClient({
      clienteId: clientId,
      adminId: revokedBy
    });

    if (!result.found) {
      return {
        clientId,
        status: 'NOT_FOUND',
        error: 'Client authorization not found'
      };
    }

    return {
      clientId: result.clientId,
      status: 'REVOKED',
      revokedAt: result.revokedAt
    };
  } catch (error) {
    return {
      clientId,
      status: 'ERROR',
      error: error.message
    };
  }
}

/**
 * Obtiene el estado de autorización de un cliente
 * @param {number} clientId - ID del cliente
 * @returns {Promise<Object|null>} Datos de la autorización o null si no existe
 */
async function getQrSession(clientId) {
  try {
    const auth = await qrAuthorizationRepository.getAuthorization(clientId);
    
    if (!auth) {
      return null;
    }
    
    return {
      clientId: auth.cliente_id,
      enabled: auth.enabled === 1,
      enabledAt: auth.enabled_at,
      expiresAt: auth.expires_at,
      revokedAt: auth.revoked_at,
      createdAt: auth.created_at
    };
  } catch (error) {
    return null;
  }
}

/**
 * Verifica si un cliente está autorizado para generar QR
 * @param {number} clientId - ID del cliente
 * @returns {Promise<boolean>} true si está autorizado
 */
async function isAuthorized(clientId) {
  try {
    return await qrAuthorizationRepository.isClientAuthorized(clientId);
  } catch (error) {
    // En caso de error DB, denegar por seguridad
    return false;
  }
}

module.exports = {
  authorizeQrSession,
  revokeQrSession,
  getQrSession,
  isAuthorized
};
