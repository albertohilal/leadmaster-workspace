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

function ensureSendableCampaign(campaign) {
  if (!campaign.asunto || !String(campaign.asunto).trim()) {
    throw createServiceError(400, 'CAMPAIGN_SUBJECT_REQUIRED', 'La campaña debe tener asunto');
  }

  if (!campaign.body || !String(campaign.body).trim()) {
    throw createServiceError(400, 'CAMPAIGN_BODY_REQUIRED', 'La campaña debe tener body para enviar');
  }

  if (!campaign.email_from || !String(campaign.email_from).trim()) {
    throw createServiceError(400, 'CAMPAIGN_EMAIL_FROM_REQUIRED', 'La campaña debe tener email_from para enviar');
  }
}

function ensurePreparableCampaign(campaign) {
  if (!['borrador', 'pendiente', 'pausada', 'error'].includes(campaign.estado)) {
    throw createServiceError(
      409,
      'CAMPAIGN_NOT_PREPARABLE',
      `No se puede preparar la campaña. Estado actual: ${campaign.estado}`,
      { estado: campaign.estado }
    );
  }
}

function normalizeNullableString(value) {
  if (value === undefined || value === null) return null;

  const normalized = String(value).trim();
  return normalized ? normalized : null;
}

async function resolveCampaignSenderFromClientConfig({ cliente_id, campaign }) {
  if (campaign.email_from && String(campaign.email_from).trim()) {
    return campaign;
  }

  const clientEmailConfig = await emailCampaignsService.getActiveClientEmailConfig({
    cliente_id
  });

  if (!clientEmailConfig) {
    throw createServiceError(
      404,
      'CLIENT_EMAIL_CONFIG_NOT_FOUND',
      'La campaña no tiene email_from y el cliente no tiene configuración Email activa'
    );
  }

  const resolvedEmailFrom = normalizeNullableString(clientEmailConfig.from_email);

  if (!resolvedEmailFrom) {
    throw createServiceError(
      400,
      'CLIENT_EMAIL_CONFIG_INCOMPLETE',
      'La configuración Email activa del cliente no tiene from_email'
    );
  }

  const resolvedSender = await emailCampaignsService.updateCampaignSenderFields({
    cliente_id,
    campaign_id: campaign.id,
    email_from: resolvedEmailFrom,
    name_from: normalizeNullableString(clientEmailConfig.from_name),
    reply_to_email: normalizeNullableString(clientEmailConfig.reply_to_email)
  });

  return {
    ...campaign,
    ...resolvedSender
  };
}

async function prepareCampaign({ cliente_id, campaign_id, request }) {
  const campaign = await emailCampaignsService.getOwnedCampaignById({
    cliente_id,
    campaign_id
  });

  if (!campaign) {
    throw createServiceError(404, 'CAMPAIGN_NOT_FOUND', 'Campaña email no encontrada');
  }

  ensurePreparableCampaign(campaign);

  const resolvedCampaign = await resolveCampaignSenderFromClientConfig({
    cliente_id,
    campaign
  });

  ensureSendableCampaign(resolvedCampaign);

  const scheduledFor = toMySqlDateTime(request.fecha_programada || resolvedCampaign.fecha_programada) || toMySqlDateTime(new Date());

  const [existingRows] = await db.execute(
    `SELECT id, status
     FROM ll_envios_email
     WHERE campania_email_id = ?
     ORDER BY id ASC`,
    [campaign_id]
  );

  if (!existingRows.length) {
    throw createServiceError(400, 'RECIPIENTS_REQUIRED', 'La campaña no tiene destinatarios cargados');
  }

  await db.execute(
    `UPDATE ll_envios_email
     SET
       subject = ?,
       body = ?,
       provider = ?,
       status = CASE WHEN status = 'SENT' THEN status ELSE 'PENDING' END,
       message_id = CASE WHEN status = 'SENT' THEN message_id ELSE NULL END,
       error_message = CASE WHEN status = 'SENT' THEN error_message ELSE NULL END,
       scheduled_for = CASE WHEN status = 'SENT' THEN scheduled_for ELSE NULL END,
       processing_started_at = CASE WHEN status = 'SENT' THEN processing_started_at ELSE NULL END,
       attempt_count = CASE WHEN status = 'SENT' THEN attempt_count ELSE 0 END,
       last_attempt_at = CASE WHEN status = 'SENT' THEN last_attempt_at ELSE NULL END,
       locked_by = NULL,
       locked_at = NULL,
       sent_at = CASE WHEN status = 'SENT' THEN sent_at ELSE NULL END
     WHERE campania_email_id = ?`,
    [resolvedCampaign.asunto, resolvedCampaign.body, 'smtp', campaign_id]
  );

  const [nextRows] = await db.execute(
    `SELECT id
     FROM ll_envios_email
     WHERE campania_email_id = ? AND status = 'PENDING'
     ORDER BY id ASC
     LIMIT 1`,
    [campaign_id]
  );

  if (!nextRows.length) {
    throw createServiceError(
      409,
      'NO_PENDING_RECIPIENTS',
      'La campaña no tiene destinatarios pendientes para preparar'
    );
  }

  await db.execute(
    `UPDATE ll_envios_email
     SET scheduled_for = ?
     WHERE id = ?
     LIMIT 1`,
    [scheduledFor, nextRows[0].id]
  );

  await db.execute(
    `UPDATE ll_campanias_email
     SET
       estado = 'pendiente',
       fecha_programada = ?,
       fecha_fin_envio = NULL,
       fecha_inicio_envio = CASE
         WHEN total_enviados > 0 THEN fecha_inicio_envio
         ELSE NULL
       END,
       updated_at = NOW()
     WHERE id = ? AND cliente_id = ?
     LIMIT 1`,
    [scheduledFor, campaign_id, cliente_id]
  );

  const stats = await emailCampaignStatsService.syncCampaignStats({
    campaign_id
  });

  return {
    campaign: {
    id: resolvedCampaign.id,
    nombre: resolvedCampaign.nombre,
      estado: 'pendiente',
      fecha_programada: scheduledFor,
      next_envio_id: nextRows[0].id,
      scheduling_strategy: 'first_recipient_only_then_scheduler_chain'
    },
    stats
  };
}

module.exports = {
  prepareCampaign,
  __test__: {
    resolveCampaignSenderFromClientConfig,
    toMySqlDateTime
  }
};
