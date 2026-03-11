const { createHttpError } = require("../../middleware/errorHandler");

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
  const transporter = payload && payload.transporter;
  const from = payload && payload.from;
  const replyTo = payload && payload.replyTo;

  if (!transporter) {
    throw createHttpError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "SMTP transporter is not configured"
    });
  }

  if (!from || String(from).trim() === "") {
    throw createHttpError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "SMTP from is not configured"
    });
  }

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
