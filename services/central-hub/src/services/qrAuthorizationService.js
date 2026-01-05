/**
 * QR Authorization Service
 * Fuente de verdad: MySQL (iunaorg_dyd.ll_whatsapp_qr_authorizations)
 * Fase 2 – Enforcement
 */

const db = require('../config/db'); // ⬅️ ajustá si tu helper está en otro path

/**
 * Verifica si un cliente tiene una autorización vigente
 * @param {number} clienteId
 * @returns {Promise<boolean>}
 */
async function isAuthorized(clienteId) {
  const sql = `
    SELECT 1
    FROM iunaorg_dyd.ll_whatsapp_qr_authorizations
    WHERE cliente_id = ?
      AND revoked_at IS NULL
      AND valid_from <= NOW()
      AND valid_until >= NOW()
    ORDER BY valid_until DESC
    LIMIT 1
  `;

  const [rows] = await db.execute(sql, [clienteId]);
  return rows.length > 0;
}

/**
 * Autoriza un cliente por una ventana temporal
 */
async function authorize({ clienteId, authorizedBy, validFrom, validUntil }) {
  const sql = `
    INSERT INTO iunaorg_dyd.ll_whatsapp_qr_authorizations
      (cliente_id, authorized_by, valid_from, valid_until)
    VALUES (?, ?, ?, ?)
  `;

  await db.execute(sql, [
    clienteId,
    authorizedBy,
    validFrom,
    validUntil
  ]);
}

/**
 * Revoca todas las autorizaciones activas de un cliente
 */
async function revoke({ clienteId }) {
  const sql = `
    UPDATE iunaorg_dyd.ll_whatsapp_qr_authorizations
    SET revoked_at = NOW(),
        updated_at = NOW()
    WHERE cliente_id = ?
      AND revoked_at IS NULL
  `;

  await db.execute(sql, [clienteId]);
}

module.exports = {
  isAuthorized,
  authorize,
  revoke
};
