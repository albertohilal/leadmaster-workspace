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
  SessionManagerInvalidConfigError
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
}

// Exportar instancia singleton
module.exports = new SessionManagerClient();
