const db = require('../../../config/db');

function toMySqlDateTime(value) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const pad = (part) => String(part).padStart(2, '0');

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join('-') + ' ' + [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join(':');
}

async function getOwnedCampaignById({ cliente_id, campaign_id }) {
  const [rows] = await db.execute(
    `SELECT
       id,
       cliente_id,
       nombre,
       asunto,
       body,
       estado,
       fecha_programada,
       fecha_inicio_envio,
       fecha_fin_envio,
       email_from,
       name_from,
       reply_to_email,
       total_destinatarios,
       total_enviados,
       total_fallidos,
       observaciones
     FROM ll_campanias_email
     WHERE id = ? AND cliente_id = ?
     LIMIT 1`,
    [campaign_id, cliente_id]
  );

  return rows[0] || null;
}

async function listEmailCampaigns({ cliente_id }) {
  const [rows] = await db.execute(
    `SELECT
       id,
       nombre,
       asunto,
       estado,
       updated_at
     FROM ll_campanias_email
     WHERE cliente_id = ?
     ORDER BY id DESC`,
    [cliente_id]
  );

  return rows.map((row) => ({
    id: row.id,
    nombre: row.nombre,
    subject: row.asunto,
    estado: row.estado,
    updatedAt: row.updated_at
  }));
}

async function getActiveClientEmailConfig({ cliente_id }) {
  const [rows] = await db.execute(
    `SELECT
       id,
       cliente_id,
       from_email,
       from_name,
       reply_to_email
     FROM ll_clientes_email_config
     WHERE cliente_id = ?
       AND is_active = 1
     ORDER BY id DESC
     LIMIT 1`,
    [cliente_id]
  );

  return rows[0] || null;
}

async function updateCampaignSenderFields({
  cliente_id,
  campaign_id,
  email_from,
  name_from,
  reply_to_email
}) {
  await db.execute(
    `UPDATE ll_campanias_email
     SET
       email_from = ?,
       name_from = ?,
       reply_to_email = ?,
       updated_at = NOW()
     WHERE id = ? AND cliente_id = ?
     LIMIT 1`,
    [email_from, name_from, reply_to_email, campaign_id, cliente_id]
  );

  return {
    email_from,
    name_from,
    reply_to_email
  };
}

async function createEmailCampaign({ cliente_id, request }) {
  const sql = `
    INSERT INTO ll_campanias_email (
      cliente_id,
      nombre,
      asunto,
      body,
      estado,
      fecha_programada,
      email_from,
      name_from,
      reply_to_email,
      total_destinatarios,
      total_enviados,
      total_fallidos,
      observaciones
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    cliente_id,
    request.nombre,
    request.subject,
    request.text,
    'borrador',
    null,
    null,
    null,
    null,
    0,
    0,
    0,
    null
  ];

  const [result] = await db.execute(sql, params);

  return {
    id: result.insertId,
    cliente_id,
    nombre: request.nombre,
    subject: request.subject,
    text: request.text,
    estado: 'borrador'
  };
}

module.exports = {
  createEmailCampaign,
  getActiveClientEmailConfig,
  getOwnedCampaignById,
  listEmailCampaigns,
  updateCampaignSenderFields,
  toMySqlDateTime
};