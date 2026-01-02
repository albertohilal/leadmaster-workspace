/**
 * Errores tipados para la integración con Session Manager
 */

class SessionManagerError extends Error {
  constructor(message, originalError = null) {
    super(message);
    this.name = this.constructor.name;
    this.originalError = originalError;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error cuando Session Manager no es alcanzable (conexión rechazada, host no encontrado)
 */
class SessionManagerUnreachableError extends SessionManagerError {
  constructor(message = 'Session Manager no está disponible', originalError = null) {
    super(message, originalError);
  }
}

/**
 * Error cuando una petición a Session Manager excede el timeout
 */
class SessionManagerTimeoutError extends SessionManagerError {
  constructor(message = 'Timeout al conectar con Session Manager', originalError = null) {
    super(message, originalError);
  }
}

/**
 * Error cuando la configuración de Session Manager es inválida
 */
class SessionManagerInvalidConfigError extends SessionManagerError {
  constructor(message = 'Configuración de Session Manager inválida', originalError = null) {
    super(message, originalError);
  }
}

module.exports = {
  SessionManagerError,
  SessionManagerUnreachableError,
  SessionManagerTimeoutError,
  SessionManagerInvalidConfigError
};
