const { smtpProvider } = require("./providers/smtpProvider");
const { emailLogRepository } = require("../repositories/emailLogRepository");
const { logger } = require("../utils/logger");
const { createHttpError } = require("../middleware/errorHandler");

function pickBody(payload) {
  if (payload && typeof payload.html === "string" && payload.html.trim() !== "") return payload.html;
  if (payload && typeof payload.text === "string" && payload.text.trim() !== "") return payload.text;
  return null;
}

function formatAuditErrorMessage(err) {
  if (!err) return "Unknown error";
  const code = typeof err.code === "string" ? err.code : undefined;
  const message = typeof err.message === "string" && err.message ? err.message : "Unexpected error";
  return code ? `${code}: ${message}` : message;
}

async function sendEmail(payload) {
  let emailLogId;
  try {
    emailLogId = await emailLogRepository.createPending({
      cliente_id: payload.cliente_id,
      to_email: payload.to,
      subject: payload.subject,
      body: pickBody(payload),
      provider: "smtp"
    });
    logger.info("email log created", { id: emailLogId, cliente_id: payload.cliente_id });
  } catch (err) {
    logger.error("failed to create email log", {
      cliente_id: payload && payload.cliente_id,
      message: err && err.message
    });
    throw createHttpError({
      status: 503,
      code: "SERVICE_UNAVAILABLE",
      message: "Database unavailable"
    });
  }

  try {
    const providerResult = await smtpProvider.send(payload);

    try {
      await emailLogRepository.markSent({ id: emailLogId, message_id: providerResult.message_id });
      logger.info("email marked as SENT", {
        id: emailLogId,
        cliente_id: payload.cliente_id,
        message_id: providerResult.message_id
      });
    } catch (err) {
      logger.error("failed to mark email as SENT", {
        id: emailLogId,
        cliente_id: payload.cliente_id,
        message: err && err.message
      });
    }

    return {
      ok: true,
      service: "mailer",
      cliente_id: payload.cliente_id,
      provider: "smtp",
      accepted: true,
      message_id: providerResult.message_id,
      status: "SENT",
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    const auditMessage = formatAuditErrorMessage(err);

    try {
      await emailLogRepository.markFailed({ id: emailLogId, error_message: auditMessage });
      logger.warn("email marked as FAILED", { id: emailLogId, cliente_id: payload.cliente_id });
    } catch (updateErr) {
      logger.error("failed to mark email as FAILED", {
        id: emailLogId,
        cliente_id: payload.cliente_id,
        message: updateErr && updateErr.message
      });
    }

    throw err;
  }
}

module.exports = { mailerService: { sendEmail } };
