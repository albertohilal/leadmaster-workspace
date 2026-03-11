const { smtpProvider } = require("./providers/smtpProvider");
const { emailLogRepository } = require("../repositories/emailLogRepository");
const { clientEmailConfigRepository } = require("../repositories/clientEmailConfigRepository");
const { smtpTransportFactory } = require("./smtpTransportFactory");
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

function isFallbackEnabled() {
  return smtpTransportFactory.parseBooleanLike(process.env.SMTP_FALLBACK_ENABLED) === true;
}

async function sendEmail(payload) {
  let emailLogId;
  let emailLogFinalized = false;

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

  let smtpBundle;
  let clientConfig;
  try {
    clientConfig = await clientEmailConfigRepository.findActiveByClienteId(payload.cliente_id);
  } catch (err) {
    const msg = err && err.message ? String(err.message) : "Unknown error";
    const auditMessage = `CLIENT_EMAIL_CONFIG_LOAD_FAILED: ${msg}`;

    try {
      await emailLogRepository.markFailed({ id: emailLogId, error_message: auditMessage });
      emailLogFinalized = true;
      logger.warn("email marked as FAILED", { id: emailLogId, cliente_id: payload.cliente_id });
    } catch (updateErr) {
      logger.error("failed to mark email as FAILED", {
        id: emailLogId,
        cliente_id: payload.cliente_id,
        message: updateErr && updateErr.message
      });
    }

    throw createHttpError({
      status: 503,
      code: "SERVICE_UNAVAILABLE",
      message: "Database unavailable"
    });
  }

  if (clientConfig) {
    logger.info("client smtp config loaded", {
      cliente_id: payload.cliente_id,
      config_id: clientConfig.id
    });

    try {
      smtpBundle = smtpTransportFactory.createClientTransport(clientConfig);
      logger.info("transporter created for cliente_id", { cliente_id: payload.cliente_id });
    } catch (err) {
      const msg = err && err.message ? String(err.message) : "Unknown error";
      const auditMessage = `CLIENT_EMAIL_CONFIG_LOAD_FAILED: ${msg}`;

      try {
        await emailLogRepository.markFailed({ id: emailLogId, error_message: auditMessage });
        emailLogFinalized = true;
        logger.warn("email marked as FAILED", { id: emailLogId, cliente_id: payload.cliente_id });
      } catch (updateErr) {
        logger.error("failed to mark email as FAILED", {
          id: emailLogId,
          cliente_id: payload.cliente_id,
          message: updateErr && updateErr.message
        });
      }

      throw createHttpError({
        status: 503,
        code: "SERVICE_UNAVAILABLE",
        message: "Database unavailable"
      });
    }
  } else {
    logger.warn("client smtp config not found", { cliente_id: payload.cliente_id });

    if (!isFallbackEnabled()) {
      try {
        await emailLogRepository.markFailed({ id: emailLogId, error_message: "CLIENT_EMAIL_CONFIG_NOT_FOUND" });
        emailLogFinalized = true;
        logger.warn("email marked as FAILED", { id: emailLogId, cliente_id: payload.cliente_id });
      } catch (updateErr) {
        logger.error("failed to mark email as FAILED", {
          id: emailLogId,
          cliente_id: payload.cliente_id,
          message: updateErr && updateErr.message
        });
      }

      throw createHttpError({
        status: 404,
        code: "CLIENT_EMAIL_CONFIG_NOT_FOUND",
        message: "Client SMTP config not found"
      });
    } else {
      logger.info("using fallback smtp from env", { cliente_id: payload.cliente_id });

      try {
        smtpBundle = smtpTransportFactory.createFallbackTransportFromEnv();
        logger.info("transporter created for cliente_id", { cliente_id: payload.cliente_id, fallback: true });
      } catch (err) {
        const msg = err && err.message ? String(err.message) : "Unknown error";
        const auditMessage = `SMTP_FALLBACK_CONFIG_FAILED: ${msg}`;

        try {
          await emailLogRepository.markFailed({ id: emailLogId, error_message: auditMessage });
          emailLogFinalized = true;
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
  }

  try {
    const providerResult = await smtpProvider.send({
      transporter: smtpBundle.transporter,
      from: smtpBundle.from,
      replyTo: smtpBundle.replyTo,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html
    });

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
    if (emailLogFinalized) throw err;

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
