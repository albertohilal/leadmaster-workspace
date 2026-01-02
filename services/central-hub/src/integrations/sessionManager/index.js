/**
 * Punto de entrada para el módulo de integración con Session Manager
 * 
 * Exporta:
 * - sessionManagerClient: Cliente HTTP singleton
 * - Errores tipados para manejo de excepciones
 */

const sessionManagerClient = require('./sessionManagerClient');
const {
  SessionManagerError,
  SessionManagerUnreachableError,
  SessionManagerTimeoutError,
  SessionManagerInvalidConfigError
} = require('./errors');

module.exports = {
  sessionManagerClient,
  SessionManagerError,
  SessionManagerUnreachableError,
  SessionManagerTimeoutError,
  SessionManagerInvalidConfigError
};
