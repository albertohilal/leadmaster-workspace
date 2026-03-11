const { getPool } = require("../config/db");

async function findActiveByClienteId(cliente_id) {
  const pool = getPool();

  const sql = `
    SELECT
      id,
      cliente_id,
      smtp_host,
      smtp_port,
      smtp_secure,
      smtp_user,
      smtp_pass,
      from_email,
      from_name,
      reply_to_email
    FROM ll_clientes_email_config
    WHERE cliente_id = ?
      AND is_active = 1
    ORDER BY id DESC
    LIMIT 1
  `;

  const [rows] = await pool.execute(sql, [cliente_id]);
  if (!rows || rows.length === 0) return null;

  const row = rows[0];

  return {
    id: row.id,
    cliente_id: row.cliente_id,
    smtp_host: row.smtp_host,
    smtp_port: row.smtp_port,
    smtp_secure: row.smtp_secure,
    smtp_user: row.smtp_user,
    smtp_pass: row.smtp_pass,
    from_email: row.from_email,
    from_name: row.from_name,
    reply_to_email: row.reply_to_email
  };
}

module.exports = {
  clientEmailConfigRepository: {
    findActiveByClienteId
  }
};
