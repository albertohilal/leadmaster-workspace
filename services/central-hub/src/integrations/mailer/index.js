/**
 * Punto de entrada para el módulo de integración con leadmaster-mailer
 */

const mailerClient = require('./mailerClient');
const {
  MailerError,
  MailerUnreachableError,
  MailerTimeoutError,
  MailerInvalidConfigError,
  MailerHttpError
} = require('./errors');

module.exports = {
  mailerClient,
  MailerError,
  MailerUnreachableError,
  MailerTimeoutError,
  MailerInvalidConfigError,
  MailerHttpError
};
