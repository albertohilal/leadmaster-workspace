const { getPool } = require("../config/db");

async function createPending({ cliente_id, to_email, subject, body, provider = "smtp" }) {
  const pool = getPool();

  const sql = `
    INSERT INTO ll_envios_email
      (cliente_id, to_email, subject, body, provider, status)
    VALUES
      (?, ?, ?, ?, ?, 'PENDING')
  `;

  const params = [cliente_id, to_email, subject || null, body || null, provider];

  const [result] = await pool.execute(sql, params);

  return result.insertId;
}

async function reuseExistingPending({ id, cliente_id, to_email, subject, body, provider = "smtp" }) {
  const pool = getPool();

  const sql = `
    UPDATE ll_envios_email
    SET
      cliente_id = ?,
      to_email = ?,
      subject = ?,
      body = ?,
      provider = ?,
      status = 'PENDING',
      message_id = NULL,
      error_message = NULL,
      sent_at = NULL
    WHERE id = ?
    LIMIT 1
  `;

  const params = [cliente_id, to_email, subject || null, body || null, provider, id];

  const [result] = await pool.execute(sql, params);
  return result.affectedRows === 1;
}

async function markSent({ id, message_id }) {
  const pool = getPool();

  const sql = `
    UPDATE ll_envios_email
    SET
      status = 'SENT',
      message_id = ?,
      sent_at = NOW(),
      error_message = NULL
    WHERE id = ?
    LIMIT 1
  `;

  const params = [message_id || null, id];
  await pool.execute(sql, params);
}

async function markFailed({ id, error_message }) {
  const pool = getPool();

  const sql = `
    UPDATE ll_envios_email
    SET
      status = 'FAILED',
      error_message = ?
    WHERE id = ?
    LIMIT 1
  `;

  const params = [error_message || null, id];
  await pool.execute(sql, params);
}

module.exports = {
  emailLogRepository: {
    createPending,
    reuseExistingPending,
    markSent,
    markFailed
  }
};
