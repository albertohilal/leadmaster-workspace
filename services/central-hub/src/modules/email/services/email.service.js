const { mailerClient } = require('../../../integrations/mailer');

/**
 * Envía un email vía leadmaster-mailer.
 * Central Hub orquesta; Mailer resuelve SMTP por cliente.
 */
async function sendEmail({ cliente_id, request }) {
  // Seguridad: cliente_id siempre proviene del JWT (no del body)
  const payload = {
    ...request,
    cliente_id
  };

  // No loguear payload completo (puede contener contenido sensible)
  const result = await mailerClient.sendEmail(payload);

  // Normalización mínima al formato del hub
  return {
    ok: true,
    integration: 'mailer',
    mailer: result
  };
}

module.exports = {
  sendEmail
};
