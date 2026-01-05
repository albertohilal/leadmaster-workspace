/**
 * Errores tipados para la integración con Session Manager
 */

/**
 * Enumeraciones oficiales del contrato Session Manager API
 * CONGELADAS - NO MODIFICAR
 */

/**
 * Estado de la sesión WhatsApp
 */
const SessionStatus = {
  INIT: 'init',                   // sesión creada, sin QR aún
  QR_REQUIRED: 'qr_required',     // necesita escaneo
  CONNECTING: 'connecting',       // QR escaneado, handshake
  CONNECTED: 'connected',         // sesión activa
  DISCONNECTED: 'disconnected',   // desconexión normal
  ERROR: 'error'                  // error irrecuperable
};

/**
 * Estado del código QR
 */
const QRStatus = {
  NONE: 'none',           // no aplica
  GENERATED: 'generated', // QR vigente
  EXPIRED: 'expired',     // QR vencido
  USED: 'used'            // QR escaneado
};

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

/**
 * Error cuando la sesión de WhatsApp no está lista (409 Conflict)
 */
class SessionManagerSessionNotReadyError extends SessionManagerError {
  constructor(message = 'Sesión de WhatsApp no está lista', originalError = null) {
    super(message, originalError);
  }
}

/**
 * Error interno de WhatsApp en Session Manager (500 Internal Error)
 */
class SessionManagerWhatsAppError extends SessionManagerError {
  constructor(message = 'Error interno de WhatsApp', originalError = null) {
    super(message, originalError);
  }
}

/**
 * Error de validación en la petición (400 Bad Request)
 */
class SessionManagerValidationError extends SessionManagerError {
  constructor(message = 'Error de validación en la petición', originalError = null) {
    super(message, originalError);
  }
}

/**
 * Error cuando la sesión no existe (404 Not Found)
 */
class SessionNotFoundError extends SessionManagerError {
  constructor(message = 'Sesión no encontrada', originalError = null) {
    super(message, originalError);
  }
}

/**
 * Error cuando se intenta generar QR pero la sesión ya está conectada (409 Conflict)
 */
class SessionAlreadyConnectedError extends SessionManagerError {
  constructor(message = 'La sesión ya está conectada', originalError = null) {
    super(message, originalError);
  }
}

/**
 * Error al generar código QR (500 Internal Server Error)
 */
class QRGenerationFailedError extends SessionManagerError {
  constructor(message = 'Falló la generación del código QR', originalError = null) {
    super(message, originalError);
  }
}

module.exports = {
  // Enums del contrato
  SessionStatus,
  QRStatus,
  
  // Error classes
  SessionManagerError,
  SessionManagerUnreachableError,
  SessionManagerTimeoutError,
  SessionManagerInvalidConfigError,
  SessionManagerSessionNotReadyError,
  SessionManagerWhatsAppError,
  SessionManagerValidationError,
  SessionNotFoundError,
  SessionAlreadyConnectedError,
  QRGenerationFailedError
};
