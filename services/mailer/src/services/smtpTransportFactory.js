const nodemailer = require("nodemailer");
const { createHttpError } = require("../middleware/errorHandler");

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

function parseBooleanLike(value) {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;

  const v = String(value).trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;
  return undefined;
}

function coercePort(portRaw, errorMessage) {
  const port = Number(portRaw);
  if (!Number.isFinite(port) || port <= 0) {
    throw createHttpError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: errorMessage
    });
  }
  return port;
}

function formatFrom({ from_email, from_name }) {
  const email = from_email ? String(from_email).trim() : "";
  if (!email) {
    throw createHttpError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "from_email is not configured"
    });
  }

  const name = from_name ? String(from_name).trim() : "";
  const safeName = name.replace(/\"/g, "'");
  return safeName ? `"${safeName}" <${email}>` : email;
}

function createClientTransport(clientConfig) {
  if (!clientConfig || typeof clientConfig !== "object") {
    throw createHttpError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Client SMTP config is invalid"
    });
  }

  const host = clientConfig.smtp_host ? String(clientConfig.smtp_host).trim() : "";
  if (!host) {
    throw createHttpError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "smtp_host is not configured"
    });
  }

  const port = coercePort(clientConfig.smtp_port, "smtp_port is not a valid number");
  const secure = parseBooleanLike(clientConfig.smtp_secure) === true;

  const user = clientConfig.smtp_user ? String(clientConfig.smtp_user) : "";
  const pass = clientConfig.smtp_pass ? String(clientConfig.smtp_pass) : "";
  const auth = user && pass ? { user, pass } : undefined;

  const transporter = nodemailer.createTransport({ host, port, secure, auth });

  const from = formatFrom({ from_email: clientConfig.from_email, from_name: clientConfig.from_name });
  const replyTo = clientConfig.reply_to_email ? String(clientConfig.reply_to_email).trim() : undefined;

  return { transporter, from, replyTo };
}

function createFallbackTransportFromEnv() {
  const host = getEnv("SMTP_HOST", { required: true });
  const port = coercePort(getEnv("SMTP_PORT", { required: true }), "SMTP_PORT is not a valid number");
  const secure = parseBooleanLike(getEnv("SMTP_SECURE")) === true;

  const user = getEnv("SMTP_USER");
  const pass = getEnv("SMTP_PASS");
  const auth = user && pass ? { user, pass } : undefined;

  const transporter = nodemailer.createTransport({ host, port, secure, auth });

  const from = formatFrom({
    from_email: getEnv("SMTP_FROM_EMAIL", { required: true }),
    from_name: getEnv("SMTP_FROM_NAME")
  });

  return { transporter, from, replyTo: undefined };
}

module.exports = {
  smtpTransportFactory: {
    createClientTransport,
    createFallbackTransportFromEnv,
    parseBooleanLike
  }
};
