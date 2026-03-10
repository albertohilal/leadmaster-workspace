const nodemailer = require("nodemailer");
const { createHttpError } = require("../../middleware/errorHandler");

function getEnv(name, { required = false } = {}) {
  const value = process.env[name];
  if (required && (!value || String(value).trim() === "")) {
    throw createHttpError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: `${name} is not configured`
    });
  }
  return value;
}

function parseBoolean(value) {
  if (value === undefined || value === null) return undefined;
  const v = String(value).trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;
  return undefined;
}

function buildTransporter() {
  const host = getEnv("SMTP_HOST", { required: true });
  const portRaw = getEnv("SMTP_PORT", { required: true });
  const port = Number(portRaw);
  if (!Number.isFinite(port) || port <= 0) {
    throw createHttpError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "SMTP_PORT is not a valid number"
    });
  }

  const secure = parseBoolean(getEnv("SMTP_SECURE"));

  const user = getEnv("SMTP_USER");
  const pass = getEnv("SMTP_PASS");

  const auth = user && pass ? { user, pass } : undefined;

  return nodemailer.createTransport({ host, port, secure: secure === true, auth });
}

function mapProviderError(err) {
  const code = err && typeof err.code === "string" ? err.code : undefined;

  if (code === "EAUTH") {
    return createHttpError({
      status: 502,
      code: "MAIL_PROVIDER_ERROR",
      message: "SMTP authentication failed"
    });
  }

  if (
    code === "ECONNECTION" ||
    code === "ETIMEDOUT" ||
    code === "ENOTFOUND" ||
    code === "ECONNREFUSED" ||
    code === "EAI_AGAIN"
  ) {
    return createHttpError({
      status: 503,
      code: "SERVICE_UNAVAILABLE",
      message: "Mailer provider unavailable"
    });
  }

  return createHttpError({
    status: 502,
    code: "MAIL_PROVIDER_ERROR",
    message: "SMTP provider error"
  });
}

async function send(payload) {
  const transporter = buildTransporter();

  const fromEmail = payload.from_email || getEnv("SMTP_FROM_EMAIL", { required: true });
  const fromName = payload.from_name || getEnv("SMTP_FROM_NAME", { required: true });
  const replyTo = payload.reply_to;

  const from = fromName ? `"${fromName}" <${fromEmail}>` : fromEmail;

  const mailOptions = {
    from,
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html
  };

  if (replyTo) mailOptions.replyTo = replyTo;

  try {
    const info = await transporter.sendMail(mailOptions);
    const messageId = info && info.messageId ? String(info.messageId) : `msg_${Date.now()}`;

    return { message_id: messageId };
  } catch (err) {
    throw mapProviderError(err);
  }
}

module.exports = { smtpProvider: { send } };
