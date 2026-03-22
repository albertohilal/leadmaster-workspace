const db = require('../../../config/db');

async function getCampaignStats({ campaign_id }) {
  const [rows] = await db.execute(
    `SELECT
       COUNT(*) AS total_destinatarios,
       SUM(CASE WHEN status = 'SENT' THEN 1 ELSE 0 END) AS total_enviados,
       SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) AS total_fallidos,
       SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) AS total_pendientes,
       SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) AS total_cancelados
     FROM ll_envios_email
     WHERE campania_email_id = ?`,
    [campaign_id]
  );

  const row = rows[0] || {};

  return {
    total_destinatarios: Number(row.total_destinatarios || 0),
    total_enviados: Number(row.total_enviados || 0),
    total_fallidos: Number(row.total_fallidos || 0),
    total_pendientes: Number(row.total_pendientes || 0),
    total_cancelados: Number(row.total_cancelados || 0)
  };
}

async function syncCampaignStats({ campaign_id }) {
  const stats = await getCampaignStats({ campaign_id });

  await db.execute(
    `UPDATE ll_campanias_email
     SET
       total_destinatarios = ?,
       total_enviados = ?,
       total_fallidos = ?,
       updated_at = NOW()
     WHERE id = ?
     LIMIT 1`,
    [
      stats.total_destinatarios,
      stats.total_enviados,
      stats.total_fallidos,
      campaign_id
    ]
  );

  return stats;
}

async function markCampaignInProgress({ campaign_id }) {
  await db.execute(
    `UPDATE ll_campanias_email
     SET
       estado = 'en_progreso',
       fecha_inicio_envio = COALESCE(fecha_inicio_envio, NOW()),
       updated_at = NOW()
     WHERE id = ? AND estado IN ('pendiente', 'error', 'pausada')
     LIMIT 1`,
    [campaign_id]
  );
}

async function finalizeCampaignIfCompleted({ campaign_id }) {
  const stats = await syncCampaignStats({ campaign_id });

  if (stats.total_pendientes > 0) {
    return {
      finalized: false,
      status: 'pending',
      stats
    };
  }

  const finalStatus = stats.total_enviados > 0 ? 'finalizado' : 'error';

  await db.execute(
    `UPDATE ll_campanias_email
     SET
       estado = ?,
       fecha_fin_envio = NOW(),
       updated_at = NOW()
     WHERE id = ? AND estado <> 'cancelada'
     LIMIT 1`,
    [finalStatus, campaign_id]
  );

  return {
    finalized: true,
    status: finalStatus,
    stats
  };
}

module.exports = {
  getCampaignStats,
  syncCampaignStats,
  markCampaignInProgress,
  finalizeCampaignIfCompleted
};
