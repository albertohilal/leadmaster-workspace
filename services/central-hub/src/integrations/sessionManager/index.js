/**
 * Punto de entrada para el módulo de integración con Session Manager
 * 
 * Exporta:
 * - sessionManagerClient: Cliente HTTP singleton
 * - Enums del contrato (SessionStatus, QRStatus)
 * - Errores tipados para manejo de excepciones
 */

const sessionManagerClient = require('./sessionManagerClient');
const {
  SessionStatus,
  QRStatus,
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
} = require('./errors');

module.exports = {
  sessionManagerClient,
  
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
