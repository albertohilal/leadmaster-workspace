/**
 * QR Authorization Repository
 * 
 * Capa de acceso a datos para autorizaciones QR WhatsApp.
 * Trabaja con la tabla ll_whatsapp_qr_sessions.
 * 
 * Responsabilidades:
 * - Queries SQL a tabla de autorizaciones
 * - Validación de estado de autorización
 * - CRUD de autorizaciones por cliente
 * - Zero lógica HTTP
 * - Zero lógica de negocio
 */

const pool = require('../../../config/db');

/**
 * Verifica si un cliente está autorizado para generar QR
 * @param {number} clienteId - ID del cliente
 * @returns {Promise<boolean>} true si está autorizado
 */
async function isClientAuthorized(clienteId) {
  const [rows] = await pool.query(
    `SELECT enabled, expires_at, revoked_at
     FROM ll_whatsapp_qr_sessions
     WHERE cliente_id = ?`,
    [clienteId]
  );

  if (rows.length === 0) {
    return false;
  }

  const auth = rows[0];

  // Verificar que esté habilitado
  if (auth.enabled !== 1) {
    return false;
  }

  // Verificar que no esté revocado
  if (auth.revoked_at !== null) {
    return false;
  }

  // Verificar expiración si existe
  if (auth.expires_at !== null) {
    const now = new Date();
    const expiresAt = new Date(auth.expires_at);
    if (now > expiresAt) {
      return false;
    }
  }

  return true;
}

/**
 * Habilita autorización QR para un cliente
 * @param {Object} params
 * @param {number} params.clienteId - ID del cliente
 * @param {number} params.adminId - ID del admin que autoriza
 * @param {Date|null} params.expiresAt - Fecha de expiración opcional
 * @returns {Promise<Object>} Datos de la autorización
 */
async function enableClient({ clienteId, adminId, expiresAt = null }) {
  const now = new Date();

  // Verificar si ya existe
  const [existing] = await pool.query(
    'SELECT id FROM ll_whatsapp_qr_sessions WHERE cliente_id = ?',
    [clienteId]
  );

  if (existing.length > 0) {
    // UPDATE existente
    await pool.query(
      `UPDATE ll_whatsapp_qr_sessions
       SET enabled = 1,
           enabled_by_admin_id = ?,
           enabled_at = ?,
           expires_at = ?,
           revoked_at = NULL
       WHERE cliente_id = ?`,
      [adminId, now, expiresAt, clienteId]
    );
  } else {
    // INSERT nuevo
    await pool.query(
      `INSERT INTO ll_whatsapp_qr_sessions
       (cliente_id, enabled, enabled_by_admin_id, enabled_at, expires_at, created_at)
       VALUES (?, 1, ?, ?, ?, ?)`,
      [clienteId, adminId, now, expiresAt, now]
    );
  }

  return {
    clienteId,
    enabled: true,
    enabledAt: now,
    expiresAt
  };
}

/**
 * Revoca autorización QR para un cliente
 * @param {Object} params
 * @param {number} params.clienteId - ID del cliente
 * @param {number} params.adminId - ID del admin que revoca (opcional)
 * @returns {Promise<Object>} Datos de la revocación
 */
async function revokeClient({ clienteId, adminId = null }) {
  const now = new Date();

  const [result] = await pool.query(
    `UPDATE ll_whatsapp_qr_sessions
     SET enabled = 0,
         revoked_at = ?
     WHERE cliente_id = ?`,
    [now, clienteId]
  );

  if (result.affectedRows === 0) {
    return {
      clienteId,
      found: false,
      revoked: false
    };
  }

  return {
    clienteId,
    found: true,
    revoked: true,
    revokedAt: now
  };
}

/**
 * Obtiene el estado de autorización de un cliente
 * @param {number} clienteId - ID del cliente
 * @returns {Promise<Object|null>} Datos de autorización o null
 */
async function getAuthorization(clienteId) {
  const [rows] = await pool.query(
    `SELECT id, cliente_id, enabled, enabled_by_admin_id, enabled_at,
            expires_at, revoked_at, created_at
     FROM ll_whatsapp_qr_sessions
     WHERE cliente_id = ?`,
    [clienteId]
  );

  if (rows.length === 0) {
    return null;
  }

  return rows[0];
}

module.exports = {
  isClientAuthorized,
  enableClient,
  revokeClient,
  getAuthorization
};
