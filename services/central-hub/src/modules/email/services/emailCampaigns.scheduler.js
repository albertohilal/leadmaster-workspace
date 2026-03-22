const os = require('os');
const db = require('../../../config/db');
const emailService = require('./email.service');
const emailCampaignStatsService = require('./emailCampaignStats.service');
const {
  MailerTimeoutError,
  MailerUnreachableError,
  MailerHttpError
} = require('../../../integrations/mailer');

const PROCESS_INTERVAL_MS = Number(process.env.EMAIL_CAMPAIGNS_INTERVAL_MS || 5000);
const DEFAULT_SEND_DELAY_MIN_SECONDS = Number(process.env.EMAIL_CAMPAIGN_DELAY_MIN_SECONDS || 30);
const DEFAULT_SEND_DELAY_MAX_SECONDS = Number(process.env.EMAIL_CAMPAIGN_DELAY_MAX_SECONDS || 90);
const LOCK_STALE_SECONDS = Number(process.env.EMAIL_CAMPAIGN_LOCK_STALE_SECONDS || 300);
const MAX_RETRY_ATTEMPTS = 3;
const INSTANCE_ID = `${os.hostname()}_${process.pid}_${Date.now()}`;

let processing = false;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRandomDelaySeconds() {
  const min = DEFAULT_SEND_DELAY_MIN_SECONDS;
  const max = DEFAULT_SEND_DELAY_MAX_SECONDS;
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return 30;
  }
  return min + Math.floor(Math.random() * (max - min + 1));
}

function getRetryDelaySeconds(attemptCount) {
  const normalizedAttempt = Math.max(1, Number(attemptCount) || 1);
  const baseDelay = getRandomDelaySeconds();
  return baseDelay * normalizedAttempt;
}

function isTransientHttpStatus(status) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function classifySendError(error) {
  if (error instanceof MailerTimeoutError || error instanceof MailerUnreachableError) {
    return { transient: true, reason: 'MAILER_UNAVAILABLE' };
  }

  if (error instanceof MailerHttpError) {
    return {
      transient: isTransientHttpStatus(Number(error.status || 0)),
      reason: `MAILER_HTTP_${error.status || 'ERROR'}`
    };
  }

  return {
    transient: false,
    reason: error && error.code ? String(error.code) : 'UNCLASSIFIED_ERROR'
  };
}

async function acquireCampaignLock(campaign_id) {
  const connection = await db.getConnection();

  try {
    const [rows] = await connection.execute('SELECT GET_LOCK(?, 0) AS acquired', [`email_campaign_${campaign_id}`]);

    if (Number(rows[0] && rows[0].acquired) === 1) {
      return connection;
    }

    connection.release();
    return null;
  } catch (error) {
    connection.release();
    throw error;
  }
}

async function releaseCampaignLock(campaign_id, connection) {
  if (!connection) {
    return;
  }

  try {
    await connection.execute('SELECT RELEASE_LOCK(?) AS released', [`email_campaign_${campaign_id}`]);
  } finally {
    connection.release();
  }
}

async function listActiveCampaigns() {
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
       email_from,
       name_from,
       reply_to_email
     FROM ll_campanias_email
     WHERE estado IN ('pendiente', 'en_progreso')
       AND (fecha_programada IS NULL OR fecha_programada <= NOW())
     ORDER BY COALESCE(fecha_programada, fecha_creacion) ASC, id ASC`
  );

  return rows;
}

async function claimDueRow(campaign_id) {
  const [result] = await db.execute(
    `UPDATE ll_envios_email
     SET
       locked_by = ?,
       locked_at = NOW(),
       processing_started_at = COALESCE(processing_started_at, NOW()),
       attempt_count = COALESCE(attempt_count, 0) + 1,
       last_attempt_at = NOW()
     WHERE campania_email_id = ?
       AND status = 'PENDING'
       AND scheduled_for IS NOT NULL
       AND scheduled_for <= NOW()
       AND (locked_at IS NULL OR locked_at < DATE_SUB(NOW(), INTERVAL ? SECOND))
     ORDER BY scheduled_for ASC, id ASC
     LIMIT 1`,
    [INSTANCE_ID, campaign_id, LOCK_STALE_SECONDS]
  );

  if (!result.affectedRows) {
    return null;
  }

  const [rows] = await db.execute(
    `SELECT
       id,
       cliente_id,
       campania_email_id,
       to_email,
       nombre_destino,
       lugar_id,
       subject,
       body,
       provider,
       status,
       attempt_count,
       scheduled_for
     FROM ll_envios_email
     WHERE campania_email_id = ? AND locked_by = ?
     ORDER BY locked_at DESC, id DESC
     LIMIT 1`,
    [campaign_id, INSTANCE_ID]
  );

  return rows[0] || null;
}

async function hasScheduledPendingRow(campaign_id) {
  const [rows] = await db.execute(
    `SELECT id
     FROM ll_envios_email
     WHERE campania_email_id = ?
       AND status = 'PENDING'
       AND scheduled_for IS NOT NULL
     ORDER BY scheduled_for ASC, id ASC
     LIMIT 1`,
    [campaign_id]
  );

  return rows.length ? rows[0].id : null;
}

async function scheduleNextPendingRow(campaign_id, delaySeconds) {
  const scheduledRowId = await hasScheduledPendingRow(campaign_id);
  if (scheduledRowId) {
    return scheduledRowId;
  }

  const [rows] = await db.execute(
    `SELECT id
     FROM ll_envios_email
     WHERE campania_email_id = ?
       AND status = 'PENDING'
       AND scheduled_for IS NULL
     ORDER BY id ASC
     LIMIT 1`,
    [campaign_id]
  );

  if (!rows.length) {
    return null;
  }

  const nextId = rows[0].id;
  const seconds = Number.isFinite(delaySeconds) ? Math.max(0, delaySeconds) : 0;

  await db.execute(
    `UPDATE ll_envios_email
     SET scheduled_for = DATE_ADD(NOW(), INTERVAL ? SECOND)
     WHERE id = ?
     LIMIT 1`,
    [seconds, nextId]
  );

  return nextId;
}

async function releaseRowLock({ envio_id, fallbackErrorMessage }) {
  await db.execute(
    `UPDATE ll_envios_email
     SET
       status = CASE WHEN status = 'PENDING' THEN 'FAILED' ELSE status END,
       error_message = CASE WHEN status = 'PENDING' THEN ? ELSE error_message END,
       locked_by = NULL,
       locked_at = NULL
     WHERE id = ?
     LIMIT 1`,
    [fallbackErrorMessage || null, envio_id]
  );
}

async function requeueRow({ envio_id, retryDelaySeconds, errorMessage }) {
  await db.execute(
    `UPDATE ll_envios_email
     SET
       status = 'PENDING',
       error_message = ?,
       scheduled_for = DATE_ADD(NOW(), INTERVAL ? SECOND),
       locked_by = NULL,
       locked_at = NULL
     WHERE id = ?
     LIMIT 1`,
    [errorMessage || null, retryDelaySeconds, envio_id]
  );
}

async function markRowFailed({ envio_id, errorMessage }) {
  await db.execute(
    `UPDATE ll_envios_email
     SET
       status = 'FAILED',
       error_message = ?,
       scheduled_for = NULL,
       locked_by = NULL,
       locked_at = NULL
     WHERE id = ?
     LIMIT 1`,
    [errorMessage || null, envio_id]
  );
}

async function releaseSuccessfulRow(envio_id) {
  await db.execute(
    `UPDATE ll_envios_email
     SET
       locked_by = NULL,
       locked_at = NULL
     WHERE id = ?
     LIMIT 1`,
    [envio_id]
  );
}

async function processCampaign(campaign) {
  let row = await claimDueRow(campaign.id);

  if (!row) {
    await scheduleNextPendingRow(campaign.id, 0);
    row = await claimDueRow(campaign.id);
  }

  if (!row) {
    return emailCampaignStatsService.finalizeCampaignIfCompleted({
      campaign_id: campaign.id
    });
  }

  await emailCampaignStatsService.markCampaignInProgress({
    campaign_id: campaign.id
  });

  try {
    const result = await emailService.sendEmail({
      cliente_id: campaign.cliente_id,
      request: {
        to: row.to_email,
        subject: row.subject || campaign.asunto,
        html: row.body || campaign.body,
        from_email: campaign.email_from || undefined,
        from_name: campaign.name_from || undefined,
        reply_to: campaign.reply_to_email || undefined,
        campaign_id: campaign.id,
        metadata: {
          source: 'email_campaign_scheduler',
          campania_email_id: campaign.id,
          envio_email_id: row.id
        },
        envio_email_id: row.id
      }
    });

    await releaseSuccessfulRow(row.id);
    await emailCampaignStatsService.syncCampaignStats({
      campaign_id: campaign.id
    });

    const nextDelay = getRandomDelaySeconds();
    const nextEnvioId = await scheduleNextPendingRow(campaign.id, nextDelay);

    if (!nextEnvioId) {
      await emailCampaignStatsService.finalizeCampaignIfCompleted({
        campaign_id: campaign.id
      });
    }

    return {
      sent: true,
      envio_id: row.id,
      result
    };
  } catch (error) {
    const message = error && error.message ? String(error.message) : 'EMAIL_SEND_FAILED';
    const classification = classifySendError(error);

    if (classification.transient && Number(row.attempt_count || 0) < MAX_RETRY_ATTEMPTS) {
      await requeueRow({
        envio_id: row.id,
        retryDelaySeconds: getRetryDelaySeconds(row.attempt_count),
        errorMessage: `RETRY_${classification.reason}: ${message}`
      });
    } else {
      await markRowFailed({
        envio_id: row.id,
        errorMessage: classification.transient
          ? `MAX_RETRIES_EXCEEDED_${classification.reason}: ${message}`
          : `${classification.reason}: ${message}`
      });
    }

    await emailCampaignStatsService.syncCampaignStats({
      campaign_id: campaign.id
    });

    const nextDelay = getRandomDelaySeconds();
    const nextEnvioId = await scheduleNextPendingRow(campaign.id, nextDelay);

    if (!nextEnvioId) {
      await emailCampaignStatsService.finalizeCampaignIfCompleted({
        campaign_id: campaign.id
      });
    }

    return {
      sent: false,
      envio_id: row.id,
      error: message,
      transient: classification.transient,
      attempts: Number(row.attempt_count || 0)
    };
  }
}

async function tick() {
  if (processing || process.env.NODE_ENV === 'test') {
    return;
  }

  processing = true;

  try {
    const campaigns = await listActiveCampaigns();

    for (const campaign of campaigns) {
      const lockConnection = await acquireCampaignLock(campaign.id);
      if (!lockConnection) {
        continue;
      }

      try {
        await processCampaign(campaign);
      } finally {
        await releaseCampaignLock(campaign.id, lockConnection);
      }
    }
  } finally {
    processing = false;
  }
}

function start() {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  setInterval(() => {
    tick().catch((error) => {
      console.error('[EmailCampaignsScheduler] tick error', error);
    });
  }, PROCESS_INTERVAL_MS);

  delay(0).then(() => tick()).catch((error) => {
    console.error('[EmailCampaignsScheduler] initial tick error', error);
  });
}

module.exports = {
  start,
  __test__: {
    getRandomDelaySeconds,
    processCampaign,
    scheduleNextPendingRow,
    claimDueRow,
    listActiveCampaigns,
    acquireCampaignLock,
    releaseCampaignLock,
    hasScheduledPendingRow,
    tick,
    releaseRowLock,
    releaseSuccessfulRow,
    getRetryDelaySeconds,
    classifySendError,
    requeueRow,
    markRowFailed
  }
};
