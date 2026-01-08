/**
 * Cliente HTTP para integración con Session Manager
 * 
 * Responsabilidades:
 * - Validar configuración SESSION_MANAGER_BASE_URL
 * - Realizar health checks
 * - Manejar timeouts y errores de red
 * 
 * NO implementa:
 * - Retries
 * - Lógica de negocio
 * - POST /send (en fase posterior)
 */

const {
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

class SessionManagerClient {
  constructor() {
    this.baseUrl = this._validateBaseUrl();
    this.defaultHeaders = {
      'Content-Type': 'application/json'
    };
    // Timeouts según especificación
    this.connectionTimeout = 5000;  // 5 segundos
    this.totalTimeout = 30000;      // 30 segundos
  }

  /**
   * Valida y retorna la URL base de Session Manager
   * @private
   * @throws {SessionManagerInvalidConfigError} Si la URL no está configurada o es inválida
   */
  _validateBaseUrl() {
    const baseUrl = process.env.SESSION_MANAGER_BASE_URL;

    if (!baseUrl) {
      throw new SessionManagerInvalidConfigError(
        'SESSION_MANAGER_BASE_URL no está definida en las variables de entorno'
      );
    }

    // Validar que sea una URL HTTP/HTTPS válida
    try {
      const url = new URL(baseUrl);
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error('El protocolo debe ser http o https');
      }
      return baseUrl.replace(/\/$/, ''); // Remover trailing slash
    } catch (error) {
      throw new SessionManagerInvalidConfigError(
        `SESSION_MANAGER_BASE_URL no es una URL válida: ${baseUrl}`,
        error
      );
    }
  }

  /**
   * Realiza una petición HTTP con control de timeouts
   * @private
   * @param {string} path - Ruta relativa del endpoint
   * @param {object} options - Opciones de fetch
   * @returns {Promise<Response>}
   * @throws {SessionManagerTimeoutError} Si se excede el timeout
   * @throws {SessionManagerUnreachableError} Si hay error de red
   */
  async _fetchWithTimeout(path, options = {}) {
    const url = `${this.baseUrl}${path}`;
    
    // AbortController para manejar timeouts
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.totalTimeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          ...this.defaultHeaders,
          ...options.headers
        }
      });

      clearTimeout(timeoutId);
      return response;

    } catch (error) {
      clearTimeout(timeoutId);

      // Timeout error
      if (error.name === 'AbortError') {
        throw new SessionManagerTimeoutError(
          `Timeout al conectar con Session Manager (${this.totalTimeout}ms)`,
          error
        );
      }

      // Network errors (ECONNREFUSED, ENOTFOUND, etc.)
      if (error.cause?.code === 'ECONNREFUSED' || 
          error.cause?.code === 'ENOTFOUND' ||
          error.message.includes('fetch failed')) {
        throw new SessionManagerUnreachableError(
          `No se pudo conectar con Session Manager en ${url}`,
          error
        );
      }

      // Otros errores de red
      throw new SessionManagerUnreachableError(
        `Error de red al conectar con Session Manager: ${error.message}`,
        error
      );
    }
  }

  /**
   * Verifica el estado de salud de Session Manager
   * @returns {Promise<boolean>} true si el servicio responde correctamente
   * @throws {SessionManagerUnreachableError} Si el servicio no está disponible
   * @throws {SessionManagerTimeoutError} Si se excede el timeout
   */
  async checkHealth() {
    console.log('[SessionManager] Iniciando health check...');

    try {
      const response = await this._fetchWithTimeout('/health', {
        method: 'GET'
      });

      if (response.ok) {
        console.log('[SessionManager] ✅ Health check OK');
        return true;
      }

      // Si responde pero no es 200
      const errorText = await response.text().catch(() => 'Sin detalles');
      throw new SessionManagerUnreachableError(
        `Session Manager respondió con status ${response.status}: ${errorText}`
      );

    } catch (error) {
      // Re-lanzar errores tipados
      if (error instanceof SessionManagerTimeoutError ||
          error instanceof SessionManagerUnreachableError) {
        console.error(`[SessionManager] ❌ Health check falló: ${error.message}`);
        throw error;
      }

      // Otros errores no esperados
      console.error(`[SessionManager] ❌ Error inesperado en health check:`, error);
      throw new SessionManagerUnreachableError(
        `Error inesperado al verificar salud de Session Manager: ${error.message}`,
        error
      );
    }
  }

  /**
   * Envía un mensaje de WhatsApp a través de Session Manager
   * @param {Object} params - Parámetros del mensaje
   * @param {number} params.clienteId - ID del cliente
   * @param {string} params.to - Número de teléfono destino
   * @param {string} params.message - Contenido del mensaje
   * @returns {Promise<Object>} Respuesta del Session Manager
   * @throws {SessionManagerValidationError} Si hay error de validación (400)
   * @throws {SessionManagerSessionNotReadyError} Si la sesión no está lista (409)
   * @throws {SessionManagerWhatsAppError} Si hay error interno de WhatsApp (500)
   * @throws {SessionManagerTimeoutError} Si se excede el timeout
   * @throws {SessionManagerUnreachableError} Si no se puede conectar
   */
  async sendMessage({ clienteId, to, message }) {
    try {
      const response = await this._fetchWithTimeout('/send', {
        method: 'POST',
        headers: {
          'X-Cliente-Id': String(clienteId)
        },
        body: JSON.stringify({
          cliente_id: clienteId,
          to,
          message
        })
      });

      // 200 OK - Éxito
      if (response.ok) {
        const result = await response.json();
        console.log(`[SessionManager] ✅ Mensaje enviado a ${to}`);
        return result;
      }

      // Manejo de errores HTTP
      const errorText = await response.text().catch(() => 'Sin detalles');
      
      // 400 Bad Request - Error de validación
      if (response.status === 400) {
        console.error(`[SessionManager] ❌ Error de validación: ${errorText}`);
        throw new SessionManagerValidationError(
          `Error de validación en Session Manager: ${errorText}`
        );
      }

      // 409 Conflict - Sesión no está lista
      if (response.status === 409) {
        console.error(`[SessionManager] ❌ Sesión no lista: ${errorText}`);
        throw new SessionManagerSessionNotReadyError(
          `Sesión de WhatsApp no está lista: ${errorText}`
        );
      }

      // 500 Internal Server Error - Error de WhatsApp
      if (response.status === 500) {
        console.error(`[SessionManager] ❌ Error interno de WhatsApp: ${errorText}`);
        throw new SessionManagerWhatsAppError(
          `Error interno de WhatsApp en Session Manager: ${errorText}`
        );
      }

      // Otros códigos de error no esperados
      console.error(`[SessionManager] ❌ Error inesperado (${response.status}): ${errorText}`);
      throw new SessionManagerUnreachableError(
        `Session Manager respondió con status ${response.status}: ${errorText}`
      );

    } catch (error) {
      // Re-lanzar errores tipados ya procesados
      if (error instanceof SessionManagerValidationError ||
          error instanceof SessionManagerSessionNotReadyError ||
          error instanceof SessionManagerWhatsAppError ||
          error instanceof SessionManagerTimeoutError ||
          error instanceof SessionManagerUnreachableError) {
        throw error;
      }

      // Otros errores no esperados
      console.error(`[SessionManager] ❌ Error inesperado al enviar mensaje:`, error);
      throw new SessionManagerUnreachableError(
        `Error inesperado al enviar mensaje: ${error.message}`,
        error
      );
    }
  }

  /**
   * Obtiene el estado completo de una sesión WhatsApp según el contrato oficial
   * @param {string} instanceId - ID de la instancia (ej: 'sender_51')
   * @returns {Promise<Object>} WhatsAppSession object con status, qr_status, qr_string, etc.
   * @throws {SessionNotFoundError} Si la sesión no existe (404)
   * @throws {SessionManagerTimeoutError} Si se excede el timeout
   * @throws {SessionManagerUnreachableError} Si no se puede conectar
   */
  async getSession(instanceId) {
    try {
      const response = await this._fetchWithTimeout(`/api/session-manager/sessions/${instanceId}`, {
        method: 'GET'
      });

      if (response.ok) {
        const session = await response.json();
        console.log(`[SessionManager] ✅ Sesión obtenida: ${instanceId} (status: ${session.status})`);
        return session;
      }

      // Manejo de errores HTTP
      const errorText = await response.text().catch(() => 'Sin detalles');

      // 404 Not Found - Sesión no existe
      if (response.status === 404) {
        console.error(`[SessionManager] ❌ Sesión no encontrada: ${instanceId}`);
        throw new SessionNotFoundError(
          `Sesión ${instanceId} no encontrada en Session Manager`
        );
      }

      // Otros códigos de error no esperados
      console.error(`[SessionManager] ❌ Error inesperado (${response.status}): ${errorText}`);
      throw new SessionManagerUnreachableError(
        `Session Manager respondió con status ${response.status}: ${errorText}`
      );

    } catch (error) {
      // Re-lanzar errores tipados ya procesados
      if (error instanceof SessionNotFoundError ||
          error instanceof SessionManagerTimeoutError ||
          error instanceof SessionManagerUnreachableError) {
        throw error;
      }

      // Otros errores no esperados
      console.error(`[SessionManager] ❌ Error inesperado al obtener sesión:`, error);
      throw new SessionManagerUnreachableError(
        `Error inesperado al obtener sesión: ${error.message}`,
        error
      );
    }
  }

  /**
   * Solicita la generación de un código QR para una sesión
   * @param {string} instanceId - ID de la instancia (ej: 'sender_51')
   * @returns {Promise<Object>} { qr_string, qr_expires_at }
   * @throws {SessionAlreadyConnectedError} Si la sesión ya está conectada (409)
   * @throws {QRGenerationFailedError} Si falla la generación del QR (500)
   * @throws {SessionManagerTimeoutError} Si se excede el timeout
   * @throws {SessionManagerUnreachableError} Si no se puede conectar
   */
  async requestQR(instanceId) {
    try {
      const response = await this._fetchWithTimeout(`/api/session-manager/sessions/${instanceId}/qr`, {
        method: 'POST'
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`[SessionManager] ✅ QR generado para ${instanceId}`);
        return result;
      }

      // Manejo de errores HTTP
      const errorText = await response.text().catch(() => 'Sin detalles');

      // 409 Conflict - Sesión ya está conectada
      if (response.status === 409) {
        console.error(`[SessionManager] ❌ Sesión ya conectada: ${instanceId}`);
        throw new SessionAlreadyConnectedError(
          `La sesión ${instanceId} ya está conectada. No se puede generar QR.`
        );
      }

      // 500 Internal Server Error - Error generando QR
      if (response.status === 500) {
        console.error(`[SessionManager] ❌ Error generando QR: ${errorText}`);
        throw new QRGenerationFailedError(
          `Falló la generación del QR para ${instanceId}: ${errorText}`
        );
      }

      // Otros códigos de error no esperados
      console.error(`[SessionManager] ❌ Error inesperado (${response.status}): ${errorText}`);
      throw new SessionManagerUnreachableError(
        `Session Manager respondió con status ${response.status}: ${errorText}`
      );

    } catch (error) {
      // Re-lanzar errores tipados ya procesados
      if (error instanceof SessionAlreadyConnectedError ||
          error instanceof QRGenerationFailedError ||
          error instanceof SessionManagerTimeoutError ||
          error instanceof SessionManagerUnreachableError) {
        throw error;
      }

      // Otros errores no esperados
      console.error(`[SessionManager] ❌ Error inesperado al solicitar QR:`, error);
      throw new SessionManagerUnreachableError(
        `Error inesperado al solicitar QR: ${error.message}`,
        error
      );
    }
  }

  /**
   * Obtiene el código QR ya generado (read-only)
   * @param {number} clienteId - ID del cliente
   * @returns {Promise<Object>} { qr: "data:image/png;base64,..." }
   * @throws {SessionManagerValidationError} Si clienteId inválido (400)
   * @throws {SessionNotFoundError} Si QR no disponible (404)
   * @throws {SessionAlreadyConnectedError} Si sesión no requiere QR (409)
   * @throws {SessionManagerTimeoutError} Si se excede el timeout
   * @throws {SessionManagerUnreachableError} Si no se puede conectar
   */
  async getQRCode(clienteId) {
    try {
      const response = await this._fetchWithTimeout('/qr-code', {
        method: 'GET',
        headers: {
          'X-Cliente-Id': String(clienteId)
        }
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`[SessionManager] ✅ QR obtenido para cliente ${clienteId}`);
        return result;
      }

      // Manejo de errores HTTP
      const errorText = await response.text().catch(() => 'Sin detalles');
      let errorData = {};
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        // Ignorar si no es JSON
      }

      // 400 Bad Request - Validación
      if (response.status === 400) {
        console.error(`[SessionManager] ❌ Validación fallida: ${errorText}`);
        throw new SessionManagerValidationError(
          errorData.message || `Validación fallida: ${errorText}`
        );
      }

      // 404 Not Found - QR no disponible
      if (response.status === 404) {
        console.error(`[SessionManager] ❌ QR no disponible para cliente ${clienteId}`);
        throw new SessionNotFoundError(
          errorData.message || `QR no disponible para cliente ${clienteId}`
        );
      }

      // 409 Conflict - Sesión no requiere QR
      if (response.status === 409) {
        console.error(`[SessionManager] ❌ Sesión no requiere QR: ${errorText}`);
        throw new SessionAlreadyConnectedError(
          errorData.message || `La sesión no requiere QR en este momento`
        );
      }

      // Otros códigos de error
      console.error(`[SessionManager] ❌ Error inesperado (${response.status}): ${errorText}`);
      throw new SessionManagerUnreachableError(
        `Session Manager respondió con status ${response.status}: ${errorText}`
      );

    } catch (error) {
      // Re-lanzar errores tipados
      if (error instanceof SessionManagerValidationError ||
          error instanceof SessionNotFoundError ||
          error instanceof SessionAlreadyConnectedError ||
          error instanceof SessionManagerTimeoutError ||
          error instanceof SessionManagerUnreachableError) {
        throw error;
      }

      // Otros errores no esperados
      console.error(`[SessionManager] ❌ Error inesperado al obtener QR:`, error);
      throw new SessionManagerUnreachableError(
        `Error inesperado al obtener QR: ${error.message}`,
        error
      );
    }
  }
}

// Exportar instancia singleton
module.exports = new SessionManagerClient();
