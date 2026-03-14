/**
 * Errores tipados para la integración con leadmaster-mailer
 */

class MailerError extends Error {
  constructor(message, originalError = null) {
    super(message);
    this.name = this.constructor.name;
    this.originalError = originalError;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error cuando Mailer no es alcanzable (conexión rechazada, host no encontrado)
 */
class MailerUnreachableError extends MailerError {
  constructor(message = 'Mailer no está disponible', originalError = null) {
    super(message, originalError);
  }
}

/**
 * Error cuando una petición a Mailer excede el timeout
 */
class MailerTimeoutError extends MailerError {
  constructor(message = 'Timeout al conectar con Mailer', originalError = null) {
    super(message, originalError);
  }
}

/**
 * Error cuando la configuración de Mailer es inválida
 */
class MailerInvalidConfigError extends MailerError {
  constructor(message = 'Configuración de Mailer inválida', originalError = null) {
    super(message, originalError);
  }
}

/**
 * Error cuando Mailer responde con error HTTP
 * Incluye status y body (cuando es parseable como JSON).
 */
class MailerHttpError extends MailerError {
  constructor({ message, status, body, originalError = null }) {
    super(message, originalError);
    this.status = status;
    this.body = body;
  }
}

module.exports = {
  MailerError,
  MailerUnreachableError,
  MailerTimeoutError,
  MailerInvalidConfigError,
  MailerHttpError
};
