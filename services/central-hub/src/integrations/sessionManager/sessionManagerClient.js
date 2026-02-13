/**
 * Cliente HTTP para Session Manager single-admin
 * 
 * Responsabilidades:
 * - Conectar con Session Manager single-admin
 * - Obtener estado global de WhatsApp
 * - Enviar mensajes con tracking por cliente_id
 * - Obtener QR code
 * 
 * NO implementa:
 * - Retries automáticos
 * - Lógica de sesión por cliente
 * - Multi-tenant WhatsApp
 */

const {
  SessionManagerUnreachableError,
  SessionManagerTimeoutError,
  SessionManagerInvalidConfigError,
  SessionManagerSessionNotReadyError,
  SessionManagerWhatsAppError,
  SessionManagerValidationError
} = require('./errors');

class SessionManagerClient {
  constructor() {
    this.baseUrl = this._validateBaseUrl();
    this.defaultHeaders = {
      'Content-Type': 'application/json'
    };
    this.connectionTimeout = 5000;
    this.sendTimeout = 60000; // 60s - Session Manager tarda 20-40s por mensaje
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
   */
  async _fetchWithTimeout(path, options = {}, timeout = this.sendTimeout) {
    const url = `${this.baseUrl}${path}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

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

      if (error.name === 'AbortError') {
        throw new SessionManagerTimeoutError(
          `Timeout al conectar con Session Manager (${timeout}ms)`,
          error
        );
      }

      if (error.cause?.code === 'ECONNREFUSED' || 
          error.cause?.code === 'ENOTFOUND' ||
          error.message.includes('fetch failed')) {
        throw new SessionManagerUnreachableError(
          `No se pudo conectar con Session Manager en ${url}`,
          error
        );
      }

      throw new SessionManagerUnreachableError(
        `Error de red al conectar con Session Manager: ${error.message}`,
        error
      );
    }
  }

  /**
   * Obtiene el estado global de WhatsApp
   * @param {Object} params - Parámetros opcionales
   * @param {number} params.cliente_id - ID del cliente (opcional, para multi-client)
   * @returns {Promise<Object>} Estado con status, connected, qrDataUrl, account, etc
   */
  async getStatus({ cliente_id } = {}) {
    try {
      const headers = cliente_id ? { 'X-Cliente-Id': String(cliente_id) } : {};
      
      const response = await this._fetchWithTimeout('/status', {
        method: 'GET',
        headers
      }, this.connectionTimeout);

      if (response.ok) {
        const status = await response.json();
        console.log(`[SessionManager] Estado: ${status.state || status.status}`);
        return status;
      }

      const errorText = await response.text().catch(() => 'Sin detalles');
      throw new SessionManagerUnreachableError(
        `Session Manager respondió con status ${response.status}: ${errorText}`
      );

    } catch (error) {
      if (error instanceof SessionManagerTimeoutError ||
          error instanceof SessionManagerUnreachableError) {
        throw error;
      }

      throw new SessionManagerUnreachableError(
        `Error al obtener estado: ${error.message}`,
        error
      );
    }
  }

  /**
   * Inicia la conexión WhatsApp (sin timeout)
   * @returns {Promise<Object>} Resultado de la conexión
   */
  async connect() {
    const url = `${this.baseUrl}/connect`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.defaultHeaders
      });

      if (response.ok) {
        const result = await response.json();
        console.log('[SessionManager] Conexión iniciada');
        return result;
      }

      const errorText = await response.text().catch(() => 'Sin detalles');
      throw new SessionManagerUnreachableError(
        `Error al conectar: ${errorText}`
      );

    } catch (error) {
      if (error instanceof SessionManagerUnreachableError) {
        throw error;
      }

      if (error.cause?.code === 'ECONNREFUSED' || 
          error.cause?.code === 'ENOTFOUND' ||
          error.message.includes('fetch failed')) {
        throw new SessionManagerUnreachableError(
          `No se pudo conectar con Session Manager en ${url}`,
          error
        );
      }

      throw new SessionManagerUnreachableError(
        `Error al iniciar conexión: ${error.message}`,
        error
      );
    }
  }

  /**
   * Obtiene el código QR si está disponible
   * @returns {Promise<Object>} { qrDataUrl, status }
   */
  async getQrCode() {
    try {
      const response = await this._fetchWithTimeout('/qr-code', {
        method: 'GET'
      }, this.connectionTimeout);

      if (response.ok) {
        const result = await response.json();
        console.log('[SessionManager] QR obtenido');
        return result;
      }

      if (response.status === 404) {
        const errorData = await response.json().catch(() => ({}));
        throw new SessionManagerValidationError(
          errorData.error || 'QR no disponible',
          errorData.currentStatus
        );
      }

      const errorText = await response.text().catch(() => 'Sin detalles');
      throw new SessionManagerUnreachableError(
        `Error al obtener QR: ${errorText}`
      );

    } catch (error) {
      if (error instanceof SessionManagerValidationError ||
          error instanceof SessionManagerTimeoutError ||
          error instanceof SessionManagerUnreachableError) {
        throw error;
      }

      throw new SessionManagerUnreachableError(
        `Error al obtener QR: ${error.message}`,
        error
      );
    }
  }

  /**
   * Envía un mensaje de WhatsApp
   * @param {Object} params
   * @param {number} params.cliente_id - ID del cliente (tracking lógico)
   * @param {string} params.to - Número de teléfono destino (solo dígitos)
   * @param {string} params.message - Contenido del mensaje
   * @returns {Promise<Object>} { ok: true, message_id: "wamid..." }
   * @throws {SessionManagerValidationError} Error de validación (400)
   * @throws {SessionManagerSessionNotReadyError} Sesión no lista (409)
   * @throws {SessionManagerWhatsAppError} Error interno de WhatsApp (500)
   */
  async sendMessage({ cliente_id, to, message }) {
    if (!cliente_id || !to || !message) {
      throw new SessionManagerValidationError(
        'Parámetros requeridos: cliente_id, to, message'
      );
    }

    try {
      const response = await this._fetchWithTimeout('/send', {
        method: 'POST',
        headers: {
          'X-Cliente-Id': String(cliente_id)
        },
        body: JSON.stringify({
          cliente_id,
          to,
          message
        })
      }, this.sendTimeout);

      if (response.ok) {
        const result = await response.json();

        if (!result.ok) {
          throw new SessionManagerValidationError(
            'Respuesta inválida: campo "ok" no es true'
          );
        }

        if (!result.message_id) {
          throw new SessionManagerValidationError(
            'Respuesta inválida: falta campo "message_id"'
          );
        }

        console.log(`[SessionManager] ✅ Mensaje enviado a ${to} (cliente: ${cliente_id}, message_id: ${result.message_id})`);
        return result;
      }

      const errorText = await response.text().catch(() => 'Sin detalles');
      
      if (response.status === 400) {
        throw new SessionManagerValidationError(
          `Error de validación: ${errorText}`
        );
      }

      if (response.status === 409) {
        throw new SessionManagerSessionNotReadyError(
          `Sesión de WhatsApp no está lista: ${errorText}`
        );
      }

      if (response.status === 500) {
        throw new SessionManagerWhatsAppError(
          `Error interno de WhatsApp: ${errorText}`
        );
      }

      if (response.status === 503) {
        let errorData = {};
        try {
          errorData = JSON.parse(errorText);
        } catch (_) {}

        if (errorData.code === 'SESSION_NOT_READY') {
          throw new SessionManagerSessionNotReadyError(
            errorData.message || 'Sesión no lista'
          );
        }

        throw new SessionManagerUnreachableError(
          `Session Manager 503: ${errorText}`
        );
      }

      throw new SessionManagerUnreachableError(
        `Session Manager respondió con status ${response.status}: ${errorText}`
      );

    } catch (error) {
      if (error instanceof SessionManagerValidationError ||
          error instanceof SessionManagerSessionNotReadyError ||
          error instanceof SessionManagerWhatsAppError ||
          error instanceof SessionManagerTimeoutError ||
          error instanceof SessionManagerUnreachableError) {
        throw error;
      }

      throw new SessionManagerUnreachableError(
        `Error inesperado al enviar mensaje: ${error.message}`,
        error
      );
    }
  }
}

module.exports = new SessionManagerClient();
