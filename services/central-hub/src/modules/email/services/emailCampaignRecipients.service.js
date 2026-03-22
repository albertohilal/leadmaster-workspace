const db = require('../../../config/db');
const emailCampaignsService = require('./emailCampaigns.service');
const emailCampaignStatsService = require('./emailCampaignStats.service');

function createServiceError(status, code, message, details) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  if (details !== undefined) {
    error.details = details;
  }
  return error;
}

function isEditableCampaign(campaign) {
  return ['borrador', 'pendiente', 'pausada', 'error'].includes(campaign.estado);
}

async function addRecipients({ cliente_id, campaign_id, recipients }) {
  const campaign = await emailCampaignsService.getOwnedCampaignById({
    cliente_id,
    campaign_id
  });

  if (!campaign) {
    throw createServiceError(404, 'CAMPAIGN_NOT_FOUND', 'Campaña email no encontrada');
  }

  if (!isEditableCampaign(campaign)) {
    throw createServiceError(
      409,
      'CAMPAIGN_NOT_EDITABLE',
      `No se pueden agregar destinatarios. Estado actual: ${campaign.estado}`,
      { estado: campaign.estado }
    );
  }

  if (campaign.fecha_inicio_envio || Number(campaign.total_enviados || 0) > 0) {
    throw createServiceError(
      409,
      'CAMPAIGN_ALREADY_STARTED',
      'No se pueden agregar destinatarios a una campaña que ya inició envíos'
    );
  }

  const summary = {
    inserted: 0,
    requeued: 0,
    already_pending: 0,
    skipped_sent: 0,
    details: []
  };

  for (const recipient of recipients) {
    const [existingRows] = await db.execute(
      `SELECT id, status
       FROM ll_envios_email
       WHERE campania_email_id = ? AND to_email = ?
       LIMIT 1`,
      [campaign_id, recipient.to_email]
    );

    const existing = existingRows[0];

    if (!existing) {
      const [result] = await db.execute(
        `INSERT INTO ll_envios_email (
          cliente_id,
          campania_email_id,
          to_email,
          nombre_destino,
          lugar_id,
          subject,
          body,
          provider,
          status,
          selected_at,
          scheduled_for
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', NOW(), NULL)`,
        [
          cliente_id,
          campaign_id,
          recipient.to_email,
          recipient.nombre_destino,
          recipient.lugar_id,
          campaign.asunto,
          campaign.body,
          'smtp'
        ]
      );

      summary.inserted += 1;
      summary.details.push({
        id: result.insertId,
        to_email: recipient.to_email,
        action: 'inserted'
      });
      continue;
    }

    if (existing.status === 'SENT') {
      summary.skipped_sent += 1;
      summary.details.push({
        id: existing.id,
        to_email: recipient.to_email,
        action: 'skipped_sent'
      });
      continue;
    }

    if (existing.status === 'PENDING') {
      summary.already_pending += 1;
      summary.details.push({
        id: existing.id,
        to_email: recipient.to_email,
        action: 'already_pending'
      });
      continue;
    }

    await db.execute(
      `UPDATE ll_envios_email
       SET
         nombre_destino = ?,
         lugar_id = ?,
         subject = ?,
         body = ?,
         provider = ?,
         status = 'PENDING',
         message_id = NULL,
         error_message = NULL,
         selected_at = NOW(),
         scheduled_for = NULL,
         processing_started_at = NULL,
         attempt_count = 0,
         last_attempt_at = NULL,
         locked_by = NULL,
         locked_at = NULL,
         sent_at = NULL
       WHERE id = ?
       LIMIT 1`,
      [
        recipient.nombre_destino,
        recipient.lugar_id,
        campaign.asunto,
        campaign.body,
        'smtp',
        existing.id
      ]
    );

    summary.requeued += 1;
    summary.details.push({
      id: existing.id,
      to_email: recipient.to_email,
      action: 'requeued'
    });
  }

  const stats = await emailCampaignStatsService.syncCampaignStats({
    campaign_id
  });

  return {
    campaign: {
      id: campaign.id,
      estado: campaign.estado,
      nombre: campaign.nombre
    },
    summary,
    stats
  };
}

module.exports = {
  addRecipients
};
