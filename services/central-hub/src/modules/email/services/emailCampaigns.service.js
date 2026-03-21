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
    request.asunto,
    request.body,
    'borrador',
    toMySqlDateTime(request.fecha_programada),
    request.email_from,
    request.name_from,
    request.reply_to_email,
    0,
    0,
    0,
    request.observaciones
  ];

  const [result] = await db.execute(sql, params);

  return {
    id: result.insertId,
    cliente_id,
    nombre: request.nombre,
    asunto: request.asunto,
    estado: 'borrador'
  };
}

module.exports = {
  createEmailCampaign
};