const { mailerClient } = require('../../../integrations/mailer');

/**
 * Orquesta un envío vía leadmaster-mailer.
 * - cliente_id SIEMPRE proviene del JWT (no del body)
 */
async function send({ cliente_id, request }) {
  const payload = {
    cliente_id,
    to: request.to,
    subject: request.subject,
    text: request.text
  };

  // No loguear el payload completo.
  return await mailerClient.sendEmail(payload);
}

module.exports = {
  send
};
