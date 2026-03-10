const { smtpProvider } = require("./providers/smtpProvider");

async function sendEmail(payload) {
  const providerResult = await smtpProvider.send(payload);

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
}

module.exports = { mailerService: { sendEmail } };
